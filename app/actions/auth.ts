"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { getUser } from "@/lib/auth/current";
import { requestOtp, verifyOtp } from "@/lib/auth/otp";
import { createSession, revokeSession, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth/session";
import { env, isDemo } from "@/lib/env";
import { isLocale, LOCALE_COOKIE, type MessageKey } from "@/lib/i18n";
import { normalizePhone, toAsciiDigits } from "@/lib/normalize";

export type AuthState =
  | { step: "phone"; error?: MessageKey }
  | { step: "code"; phone: string; error?: MessageKey; demoCode?: string };

const phoneSchema = z.object({ phone: z.string().min(1).max(30) }).strict();
const codeSchema = z.object({ phone: z.string().max(20), code: z.string().max(10) }).strict();

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function requestOtpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = phoneSchema.safeParse({ phone: formData.get("phone") });
  const phone = parsed.success ? normalizePhone(parsed.data.phone) : null;
  if (!phone) return { step: "phone", error: "auth.badPhone" };
  const r = await requestOtp(getDb(), { phone, ip: await clientIp(), now: new Date(), demo: isDemo(), demoOtp: env().DEMO_OTP, ipLimit: env().OTP_IP_LIMIT });
  if (!r.ok) return { step: "phone", error: "auth.rateLimited" };
  return { step: "code", phone, demoCode: r.demoCode };
}

export async function verifyOtpAction(prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = codeSchema.safeParse({ phone: formData.get("phone"), code: formData.get("code") });
  if (!parsed.success) return { step: "phone", error: "auth.badPhone" };
  const phone = normalizePhone(parsed.data.phone);
  const code = toAsciiDigits(parsed.data.code).replace(/\D/g, "");
  if (!phone) return { step: "phone", error: "auth.badPhone" };
  const demoCode = prev.step === "code" ? prev.demoCode : undefined;
  if (!/^\d{6}$/.test(code)) return { step: "code", phone, demoCode, error: "auth.badCode" };

  const db = getDb();
  const r = await verifyOtp(db, { phone, code, now: new Date() });
  if (!r.ok) {
    const key = { invalid: "auth.badCode", expired: "auth.expired", locked: "auth.locked", no_challenge: "auth.noChallenge" } as const;
    return { step: "code", phone, demoCode, error: key[r.reason] };
  }
  const token = await createSession(db, r.userId, env().SESSION_SECRET, new Date());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL_MS / 1000,
  });
  const [u] = await db.select().from(users).where(eq(users.id, r.userId)).limit(1);
  if (u && !r.isNew) jar.set(LOCALE_COOKIE, u.language, { path: "/", maxAge: 31536000, sameSite: "lax" });
  redirect(u?.role === "sales" ? "/leads" : "/");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  await revokeSession(getDb(), jar.get(SESSION_COOKIE)?.value, env().SESSION_SECRET);
  jar.delete(SESSION_COOKIE);
  redirect("/signin");
}

export async function setLocaleAction(formData: FormData): Promise<void> {
  const lang = formData.get("lang");
  if (!isLocale(lang)) return;
  (await cookies()).set(LOCALE_COOKIE, lang, { path: "/", maxAge: 31536000, sameSite: "lax" });
  const u = await getUser();
  if (u) await getDb().update(users).set({ language: lang }).where(eq(users.id, u.id));
  const back = formData.get("back");
  redirect(typeof back === "string" && back.startsWith("/") && !back.startsWith("//") ? back : "/");
}

/** Single entry point for the sign-in form: one state machine (phone -> code). */
export async function authAction(prev: AuthState, formData: FormData): Promise<AuthState> {
  return formData.get("intent") === "verify" ? verifyOtpAction(prev, formData) : requestOtpAction(prev, formData);
}
