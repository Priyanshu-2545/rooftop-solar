// OTP (MOCKED delivery, A18). 6 digits, hashed at rest, 5-min expiry, 5 attempts, single use,
// per-phone and per-IP rate limits, constant-time compare.
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { messages, otpChallenges, users } from "@/db/schema";
import { hit } from "./ratelimit";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
const PHONE_LIMIT = 3; // OTP requests per phone per 10 min
const DEFAULT_IP_LIMIT = 10;

const hashCode = (code: string, salt: string) => createHash("sha256").update(`${salt}:${code}`).digest("hex");

export type RequestResult =
  | { ok: true; demoCode?: string }
  | { ok: false; reason: "rate_limited" };

export async function requestOtp(
  db: Db,
  p: { phone: string; ip: string; now: Date; demo: boolean; demoOtp: string; ipLimit?: number },
): Promise<RequestResult> {
  const okPhone = await hit(db, `otp:phone:${p.phone}`, PHONE_LIMIT, 600, p.now);
  const okIp = await hit(db, `otp:ip:${p.ip}`, p.ipLimit ?? DEFAULT_IP_LIMIT, 600, p.now);
  if (!okPhone || !okIp) return { ok: false, reason: "rate_limited" };

  const code = p.demo ? p.demoOtp : String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  await db.insert(otpChallenges).values({
    phone: p.phone, codeHash: hashCode(code, salt), salt,
    expiresAt: new Date(p.now.getTime() + OTP_TTL_MS), ip: p.ip, createdAt: p.now,
  });
  // Mock delivery: logged to the messages table. The code itself is only stored in the body in demo mode.
  await db.insert(messages).values({
    toPhone: p.phone, channel: "sms", template: "otp", lang: "en", status: "mock_sent",
    body: p.demo ? `Your sign-in code is ${code}` : "Your sign-in code was sent.",
  });
  return { ok: true, demoCode: p.demo ? code : undefined };
}

export type VerifyResult =
  | { ok: true; userId: string; isNew: boolean }
  | { ok: false; reason: "invalid" | "expired" | "locked" | "no_challenge" };

export async function verifyOtp(
  db: Db,
  p: { phone: string; code: string; now: Date; defaultName?: string },
): Promise<VerifyResult> {
  const [ch] = await db
    .select().from(otpChallenges)
    .where(and(eq(otpChallenges.phone, p.phone), isNull(otpChallenges.consumedAt)))
    .orderBy(desc(otpChallenges.createdAt)).limit(1);
  if (!ch) return { ok: false, reason: "no_challenge" };
  if (ch.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" };
  if (p.now.getTime() >= ch.expiresAt.getTime()) return { ok: false, reason: "expired" };

  await db.update(otpChallenges).set({ attempts: ch.attempts + 1 }).where(eq(otpChallenges.id, ch.id));
  const a = Buffer.from(hashCode(p.code, ch.salt));
  const b = Buffer.from(ch.codeHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "invalid" };

  // single use: only the request that flips consumed_at wins
  const consumed = await db.update(otpChallenges).set({ consumedAt: p.now })
    .where(and(eq(otpChallenges.id, ch.id), isNull(otpChallenges.consumedAt))).returning({ id: otpChallenges.id });
  if (consumed.length === 0) return { ok: false, reason: "invalid" };

  const [existing] = await db.select().from(users).where(eq(users.phone, p.phone)).limit(1);
  if (existing) return { ok: true, userId: existing.id, isNew: false };
  const [created] = await db.insert(users)
    .values({ phone: p.phone, name: p.defaultName ?? "New customer", role: "homeowner" }).returning({ id: users.id });
  return { ok: true, userId: created.id, isNew: true };
}
