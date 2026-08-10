import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../../../db";
import { sessions, users } from "../../../../db/schema";

const cookieName = process.env.SESSION_COOKIE || "gg_session";
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === "production";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createUserSession(userId: string, reply: FastifyReply) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionDurationMs);

  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
  });

  reply.setCookie(cookieName, token, {
    path: "/",
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: Math.floor(sessionDurationMs / 1000),
  });
}

export async function destroyUserSession(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const token = request.cookies[cookieName];
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  reply.clearCookie(cookieName, { path: "/" });
}

export async function getCurrentUser(request: FastifyRequest) {
  const token = request.cookies[cookieName];
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] || null;
}

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = await getCurrentUser(request);
  if (!user) {
    await reply.code(401).send({ error: "Zaloguj siÄ™, aby kontynuowaÄ‡." });
    return null;
  }
  return user;
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = await requireUser(request, reply);
  if (!user) return null;
  if (user.role !== "admin") {
    await reply.code(403).send({ error: "Brak uprawnieÅ„ administratora." });
    return null;
  }
  return user;
}
