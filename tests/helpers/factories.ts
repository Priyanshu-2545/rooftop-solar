import { readFileSync } from "node:fs";
import { users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import type { LeadInput } from "@/lib/leads/validate";
import { testDb } from "./testdb";

let n = 0;
export async function makeUser(role: "homeowner" | "sales" = "homeowner", over: Partial<typeof users.$inferInsert> = {}): Promise<SessionUser> {
  n += 1;
  const [u] = await testDb.insert(users).values({
    phone: `+91900001${String(1000 + n)}`, name: `Test User${n}`, role, ...over,
  }).returning();
  return { id: u.id, phone: u.phone, name: u.name, role: u.role, isAdmin: u.isAdmin, language: u.language };
}

export const sampleBill = (f = "bill-good-340.png") => readFileSync(`samples/bills/${f}`);

export const leadInput = (over: Partial<LeadInput> = {}): LeadInput => ({
  ownerType: "owner", roofType: "rcc_flat", roofAreaSqft: 420, monthlyBillPaise: 320_000, pincode: "440010",
  idempotencyKey: `key-${Math.random().toString(36).slice(2)}-${Date.now()}`, ...over,
});
