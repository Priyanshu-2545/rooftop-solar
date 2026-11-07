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

import { appSettings, priceRules, projectStages, subsidyRules } from "@/db/schema";
import { STAGES } from "@/db/stages";

/** Reference data the quote engine needs (same shape as the seed, assumptions A1/A9). */
export async function seedReference() {
  const from = new Date("2024-01-01T00:00:00Z");
  await testDb.insert(projectStages).values(STAGES.map((g) => ({
    code: g.code, order: g.order, stuckAfterDays: g.stuck, labelEn: g.en, labelMr: g.mr, labelHi: g.hi, nextEn: g.nextEn, nextMr: g.nextMr, nextHi: g.nextHi,
  })));
  const rows = [] as (typeof priceRules.$inferInsert)[];
  for (let kw = 1; kw <= 10; kw++) for (const [tier, per] of [["standard", 55_000], ["premium", 60_000]] as const)
    rows.push({ kw, tier, pricePaise: kw * per * 100, effectiveFrom: from, effectiveTo: null });
  await testDb.insert(priceRules).values(rows);
  await testDb.insert(subsidyRules).values({
    scheme: "test", customerType: "residential", perKwPaise: 3_000_000, firstKwLimit: 2, extraKwPaise: 1_800_000, capPaise: 7_800_000,
    effectiveFrom: from, effectiveTo: null, verified: false, sourceNote: "test",
  });
  await testDb.insert(appSettings).values([
    { key: "units_per_kw_year", value: "1400", effectiveFrom: from },
    { key: "tariff_rate_paise_per_unit", value: "800", effectiveFrom: from },
  ]);
}
