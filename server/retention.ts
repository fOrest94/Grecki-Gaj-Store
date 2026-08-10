import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "../db";
import {
  carts,
  orders,
  retentionRuns,
  returnRequests,
  sessions,
} from "../db/schema";

export async function runRetention() {
  const [run] = await db
    .insert(retentionRuns)
    .values({ status: "running" })
    .returning({ id: retentionRuns.id });

  try {
    const orderCutoff = new Date();
    orderCutoff.setFullYear(orderCutoff.getFullYear() - 3);

    const anonymized = await db
      .update(orders)
      .set({
        userId: null,
        guestEmail: null,
        firstName: null,
        lastName: null,
        phone: null,
        street: null,
        postalCode: null,
        city: null,
        anonymizedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(lt(orders.createdAt, orderCutoff), isNull(orders.anonymizedAt)),
      )
      .returning({ id: orders.id });

    await db
      .update(returnRequests)
      .set({
        userId: null,
        email: "dane-zanonimizowane@invalid.local",
        description: "Dane zgłoszenia usunięte zgodnie z polityką retencji.",
        updatedAt: new Date(),
      })
      .where(
        and(
          lt(returnRequests.createdAt, orderCutoff),
          eq(returnRequests.status, "completed"),
        ),
      );

    const deletedSessionRows = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, new Date()))
      .returning({ tokenHash: sessions.tokenHash });

    const deletedCartRows = await db
      .delete(carts)
      .where(
        and(
          lt(carts.expiresAt, new Date()),
          sql`${carts.status} <> 'converted'`,
        ),
      )
      .returning({ id: carts.id });

    await db
      .update(retentionRuns)
      .set({
        finishedAt: new Date(),
        anonymizedOrders: anonymized.length,
        deletedSessions: deletedSessionRows.length,
        deletedCarts: deletedCartRows.length,
        status: "completed",
      })
      .where(eq(retentionRuns.id, run.id));

    return {
      anonymizedOrders: anonymized.length,
      deletedSessions: deletedSessionRows.length,
      deletedCarts: deletedCartRows.length,
    };
  } catch (error) {
    await db
      .update(retentionRuns)
      .set({
        finishedAt: new Date(),
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      })
      .where(eq(retentionRuns.id, run.id));
    throw error;
  }
}

export function scheduleDailyRetention() {
  const oneDay = 24 * 60 * 60 * 1000;
  const timer = setInterval(() => {
    void runRetention().catch((error) => {
      console.error("Retention job failed", error);
    });
  }, oneDay);
  timer.unref();
}
