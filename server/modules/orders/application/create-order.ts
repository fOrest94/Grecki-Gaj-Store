import { randomBytes } from "node:crypto";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../db";
import {
  carts,
  orders,
  orderItems,
  orderStatusHistory,
  payments,
  products,
  shipments,
} from "../../../../db/schema";
import { StockConflictError } from "../../inventory/domain/stock-conflict.error";
import { money } from "../../../shared/money";

export const createOrderInputSchema = z.object({
  cartToken: z.string().uuid(),
  customer: z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional().default(""),
    street: z.string().min(3),
    zip: z.string().min(5),
    city: z.string().min(2),
  }),
  delivery: z.enum(["locker", "courier"]),
  lockerCode: z.string().optional(),
  lockerAddress: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export class OrderCreationError extends Error {
  constructor(
    public readonly statusCode: 400,
    message: string,
  ) {
    super(message);
    this.name = "OrderCreationError";
  }
}

export async function createOrder(input: CreateOrderInput, userId?: string) {
  const cart = await db.query.carts.findFirst({
    where: and(eq(carts.token, input.cartToken), eq(carts.status, "active")),
    with: { items: { with: { product: true } } },
  });

  if (!cart || !cart.items.length) {
    throw new OrderCreationError(400, "Koszyk jest pusty lub wygasÅ‚.");
  }

  if (
    input.delivery === "locker" &&
    (!input.lockerCode || !input.lockerAddress)
  ) {
    throw new OrderCreationError(400, "Wybierz Paczkomat.");
  }

  for (const item of cart.items) {
    if (item.product.softDeletedAt || item.product.stock < item.quantity) {
      throw new StockConflictError(item.product.name);
    }
  }

  const subtotal = money(
    cart.items.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0,
    ),
  );
  const deliveryCost =
    subtotal >= 199 ? 0 : input.delivery === "locker" ? 12.99 : 16.99;
  const total = money(subtotal + deliveryCost);
  const now = new Date();
  const number =
    "GG/" +
    now.getFullYear() +
    "/" +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    "-" +
    randomBytes(2).toString("hex").toUpperCase();
  const dueAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const order = await db.transaction(async (tx) => {
    const [createdOrder] = await tx
      .insert(orders)
      .values({
        number,
        userId,
        cartId: cart.id,
        guestEmail: input.customer.email.toLowerCase(),
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
        phone: input.customer.phone,
        street: input.customer.street,
        postalCode: input.customer.zip,
        city: input.customer.city,
        status: "awaiting_payment",
        subtotal: subtotal.toFixed(2),
        deliveryCost: deliveryCost.toFixed(2),
        total: total.toFixed(2),
      })
      .returning();

    await tx.insert(orderItems).values(
      cart.items.map((item) => ({
        orderId: createdOrder.id,
        productId: item.productId,
        productName: item.product.name,
        productUnit: item.product.unit,
        unitPrice: item.product.price,
        quantity: item.quantity,
        lineTotal: money(Number(item.product.price) * item.quantity).toFixed(2),
      })),
    );
    await tx.insert(orderStatusHistory).values({
      orderId: createdOrder.id,
      status: "awaiting_payment",
      note: "ZamÃ³wienie zostaÅ‚o zÅ‚oÅ¼one.",
    });
    await tx.insert(payments).values({
      orderId: createdOrder.id,
      amount: total.toFixed(2),
      transferReference: number,
      dueAt,
    });
    await tx.insert(shipments).values({
      orderId: createdOrder.id,
      method: input.delivery,
      lockerCode: input.delivery === "locker" ? input.lockerCode : null,
      lockerAddress: input.delivery === "locker" ? input.lockerAddress : null,
    });

    for (const item of cart.items) {
      const [updatedProduct] = await tx
        .update(products)
        .set({
          stock: sql`${products.stock} - ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(products.id, item.productId),
            gte(products.stock, item.quantity),
            isNull(products.softDeletedAt),
          ),
        )
        .returning({ id: products.id });

      if (!updatedProduct) {
        throw new StockConflictError(item.product.name);
      }
    }

    await tx
      .update(carts)
      .set({ status: "converted", updatedAt: new Date() })
      .where(eq(carts.id, cart.id));

    return createdOrder;
  });

  return { order, total, dueAt };
}
