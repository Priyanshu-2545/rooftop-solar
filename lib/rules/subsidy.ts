// Subsidy maths. Pure. The AI NEVER computes this; it comes from dated rows only.
//
// Seeded rule (ASSUMPTION A1, UNVERIFIED, from the client's statement):
//   ₹30,000/kW up to 2 kW + ₹18,000 for the 3rd kW, capped at ₹78,000.
// ASSUMPTION A4: sizes are whole or half kW. Half kW is pro-rated linearly (e.g. 2.5 kW = 60,000 + 9,000).
// ASSUMPTION A10: customer types with no rule row (e.g. commercial) get no subsidy.

import { NoEffectiveRuleError, selectEffectiveRule, type Dated } from "./effective";
import type { Paise } from "./money";

export type CustomerType = "residential" | "commercial";

export interface SubsidyRule extends Dated {
  id: string;
  customerType: CustomerType;
  perKwPaise: Paise;
  firstKwLimit: number; // kW paid at perKwPaise (2)
  extraKwPaise: Paise; // paid for the next 1 kW (18,000)
  capPaise: Paise;
}

export type SubsidyWarning = "no_rule_for_customer_type" | "no_rule_on_date";

export interface SubsidyResult {
  subsidyPaise: Paise;
  ruleId: string | null;
  capReached: boolean; // true when the scheme cap applies or is exactly reached (3 kW = ₹78,000)
  warning: SubsidyWarning | null;
}

export class InvalidKwError extends RangeError {
  constructor(kw: number) {
    super(`System size must be a positive whole or half kW, got ${kw}`);
    this.name = "InvalidKwError";
  }
}

export function assertValidKw(kw: number): void {
  if (!Number.isFinite(kw) || kw <= 0 || !Number.isInteger(kw * 2)) throw new InvalidKwError(kw);
}

export function computeSubsidy(input: {
  kw: number;
  customerType: CustomerType;
  on: Date;
  rules: readonly SubsidyRule[];
}): SubsidyResult {
  assertValidKw(input.kw);
  const series = input.rules.filter((r) => r.customerType === input.customerType);
  if (series.length === 0) {
    return { subsidyPaise: 0, ruleId: null, capReached: false, warning: "no_rule_for_customer_type" };
  }
  let rule: SubsidyRule;
  try {
    rule = selectEffectiveRule(series, input.on);
  } catch (e) {
    if (e instanceof NoEffectiveRuleError) {
      return { subsidyPaise: 0, ruleId: null, capReached: false, warning: "no_rule_on_date" };
    }
    throw e; // overlap/gap = bad data: fail loudly
  }
  // Work in half-kW integers so no float arithmetic touches money.
  const halfKw = Math.round(input.kw * 2);
  const firstHalf = Math.min(halfKw, rule.firstKwLimit * 2);
  const extraHalf = Math.min(Math.max(halfKw - rule.firstKwLimit * 2, 0), 2); // only the next 1 kW
  const raw = Math.round((rule.perKwPaise * firstHalf) / 2 + (rule.extraKwPaise * extraHalf) / 2);
  const subsidyPaise = Math.min(raw, rule.capPaise);
  return { subsidyPaise, ruleId: rule.id, capReached: raw >= rule.capPaise, warning: null };
}
