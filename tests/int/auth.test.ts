import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { messages, otpChallenges, users } from "@/db/schema";
import { MAX_ATTEMPTS, OTP_TTL_MS, requestOtp, verifyOtp } from "@/lib/auth/otp";
import { createSession, revokeSession, verifySession } from "@/lib/auth/session";
import { resetDb, testDb as db } from "../helpers/testdb";

const SECRET = "test-secret-test-secret-test-secret-123456";
const phone = "+919000000001";
const t0 = new Date("2026-11-06T10:00:00Z");
const req = (over: Partial<Parameters<typeof requestOtp>[1]> = {}) =>
  requestOtp(db, { phone, ip: "1.1.1.1", now: t0, demo: true, demoOtp: "123456", ...over });

beforeEach(resetDb);

describe("OTP", () => {
  it("accepts the right code once and creates a homeowner", async () => {
    await req();
    const r = await verifyOtp(db, { phone, code: "123456", now: t0 });
    expect(r).toMatchObject({ ok: true, isNew: true });
  });
  it("hashes the code at rest", async () => {
    await req();
    const [ch] = await db.select().from(otpChallenges);
    expect(ch.codeHash).not.toContain("123456");
    expect(ch.codeHash).toHaveLength(64);
  });
  it("rejects a wrong code", async () => {
    await req();
    expect(await verifyOtp(db, { phone, code: "000000", now: t0 })).toEqual({ ok: false, reason: "invalid" });
  });
  it("expires after 5 minutes", async () => {
    await req();
    const late = new Date(t0.getTime() + OTP_TTL_MS);
    expect(await verifyOtp(db, { phone, code: "123456", now: late })).toEqual({ ok: false, reason: "expired" });
  });
  it("blocks reuse of a consumed code", async () => {
    await req();
    await verifyOtp(db, { phone, code: "123456", now: t0 });
    expect(await verifyOtp(db, { phone, code: "123456", now: t0 })).toEqual({ ok: false, reason: "no_challenge" });
  });
  it("locks after 5 wrong attempts, even with the right code", async () => {
    await req();
    for (let i = 0; i < MAX_ATTEMPTS; i++) await verifyOtp(db, { phone, code: "999999", now: t0 });
    expect(await verifyOtp(db, { phone, code: "123456", now: t0 })).toEqual({ ok: false, reason: "locked" });
  });
  it("rate limits OTP requests per phone", async () => {
    for (let i = 0; i < 3; i++) expect((await req({ ip: `9.9.9.${i}` })).ok).toBe(true);
    expect(await req({ ip: "9.9.9.9" })).toEqual({ ok: false, reason: "rate_limited" });
  });
  it("rate limits OTP requests per IP", async () => {
    for (let i = 0; i < 10; i++) expect((await req({ phone: `+91900000${1000 + i}` })).ok).toBe(true);
    expect(await req({ phone: "+919000002000" })).toEqual({ ok: false, reason: "rate_limited" });
  });
  it("does not reveal the code in non-demo mode", async () => {
    const r = await req({ demo: false });
    expect(r).toEqual({ ok: true, demoCode: undefined });
    const [m] = await db.select().from(messages);
    expect(m.body).not.toMatch(/\d{6}/);
  });
  it("logs the mock SMS to the messages table in demo mode", async () => {
    await req();
    const [m] = await db.select().from(messages);
    expect(m).toMatchObject({ template: "otp", status: "mock_sent", toPhone: phone });
  });
});

describe("sessions", () => {
  async function user() {
    const [u] = await db.insert(users).values({ phone, name: "Test", role: "homeowner" }).returning();
    return u;
  }
  it("verifies a fresh token", async () => {
    const u = await user();
    const token = await createSession(db, u.id, SECRET, t0);
    expect(await verifySession(db, token, SECRET, t0)).toMatchObject({ id: u.id, role: "homeowner" });
  });
  it("rejects a tampered token and a wrong secret", async () => {
    const u = await user();
    const token = await createSession(db, u.id, SECRET, t0);
    expect(await verifySession(db, token.slice(0, -2) + "xx", SECRET, t0)).toBeNull();
    expect(await verifySession(db, token, "another-secret-another-secret-123456", t0)).toBeNull();
    expect(await verifySession(db, undefined, SECRET, t0)).toBeNull();
  });
  it("rejects an expired token", async () => {
    const u = await user();
    const token = await createSession(db, u.id, SECRET, t0);
    expect(await verifySession(db, token, SECRET, new Date(t0.getTime() + 13 * 3600_000))).toBeNull();
  });
  it("logout revokes server-side", async () => {
    const u = await user();
    const token = await createSession(db, u.id, SECRET, new Date());
    await revokeSession(db, token, SECRET);
    expect(await verifySession(db, token, SECRET, new Date())).toBeNull();
  });
  it("issues a different token on each login (rotation)", async () => {
    const u = await user();
    const a = await createSession(db, u.id, SECRET, t0);
    const b = await createSession(db, u.id, SECRET, t0);
    expect(a).not.toBe(b);
  });
  it("keeps users untouched by failed lookups", async () => {
    expect(await db.select().from(users).where(eq(users.phone, phone))).toHaveLength(0);
  });
});
