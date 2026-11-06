// Sessions: signed JWT (jose) in an httpOnly cookie + a server-side sessions row (jti) so logout truly revokes.
import { SignJWT, jwtVerify } from "jose";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type SessionUser = {
  id: string; phone: string; name: string; role: "homeowner" | "sales"; isAdmin: boolean; language: "en" | "mr" | "hi";
};

const key = (secret: string) => new TextEncoder().encode(secret);

/** New session row + token on every login (rotation). */
export async function createSession(db: Db, userId: string, secret: string, now: Date): Promise<string> {
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const [row] = await db.insert(sessions).values({ userId, expiresAt, createdAt: now }).returning({ id: sessions.id });
  return new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setJti(row.id)
    .setIssuedAt(Math.floor(now.getTime() / 1000)).setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(key(secret));
}

export async function verifySession(db: Db, token: string | undefined, secret: string, now: Date): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"], currentDate: now });
    if (!payload.jti || !payload.sub) return null;
    const [row] = await db
      .select({ id: users.id, phone: users.phone, name: users.name, role: users.role, isAdmin: users.isAdmin, language: users.language })
      .from(sessions).innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, payload.jti), eq(sessions.userId, payload.sub), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)))
      .limit(1);
    return row ?? null;
  } catch {
    return null; // bad signature / expired / malformed
  }
}

export async function revokeSession(db: Db, token: string | undefined, secret: string): Promise<void> {
  if (!token) return;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    if (payload.jti) await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, payload.jti));
  } catch {
    /* nothing to revoke */
  }
}
