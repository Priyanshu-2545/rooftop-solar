// Transparent rule-based lead score. No model. A low score NEVER rejects a lead.
// ASSUMPTION A11 thresholds; A26: Medium -> survey (a human checks first), Low -> short call.
import { monthlyUnitsToKw, roofFits } from "./size";
import type { Paise } from "./money";

export type ScoreBand = "high" | "medium" | "low";
export type NextStep = "survey" | "call";
export type ScoreReason =
  | "tenant"
  | "small_bill"
  | "strong_bill"
  | "roof_too_small"
  | "mid_bill"
  | "needs_human_check";

export interface ScoreInput {
  ownerType: "owner" | "tenant";
  billPaise: Paise;
  unitsPerMonth: number | null;
  roofAreaSqft: number;
  roofType: "rcc_flat" | "sloped_tin" | "sloped_tile" | "other";
  confirmedBill: boolean; // a person confirmed the bill values
  lowConfidence?: boolean; // any extracted field was "check this" and not edited
}

export interface ScoreResult {
  band: ScoreBand;
  reasons: ScoreReason[];
  nextStep: NextStep;
  recommendedKw: number | null;
  needsHumanCheck: boolean;
}

const SMALL_BILL_PAISE = 100_000; // ₹1,000
const HIGH_BILL_PAISE = 250_000; // ₹2,500
const SMALL_UNITS = 100;
const HIGH_UNITS = 250;

export function scoreLead(input: ScoreInput): ScoreResult {
  const units = input.unitsPerMonth;
  const kw = units === null ? null : monthlyUnitsToKw(units);

  if (input.ownerType === "tenant") {
    return { band: "low", reasons: ["tenant"], nextStep: "call", recommendedKw: null, needsHumanCheck: false };
  }
  if (input.billPaise < SMALL_BILL_PAISE || (units !== null && units < SMALL_UNITS)) {
    return { band: "low", reasons: ["small_bill"], nextStep: "call", recommendedKw: kw, needsHumanCheck: false };
  }

  const strong = input.billPaise >= HIGH_BILL_PAISE && units !== null && units >= HIGH_UNITS;
  const fits = kw !== null && roofFits(input.roofAreaSqft, kw);

  if (strong && fits) {
    const unsure = !input.confirmedBill || input.lowConfidence === true;
    if (unsure) {
      return {
        band: "medium",
        reasons: ["strong_bill", "needs_human_check"],
        nextStep: "survey",
        recommendedKw: kw,
        needsHumanCheck: true,
      };
    }
    return { band: "high", reasons: ["strong_bill"], nextStep: "survey", recommendedKw: kw, needsHumanCheck: false };
  }

  const reasons: ScoreReason[] = strong ? ["roof_too_small"] : ["mid_bill"];
  const unsure = !input.confirmedBill || input.lowConfidence === true;
  if (unsure) reasons.push("needs_human_check");
  return { band: "medium", reasons, nextStep: "survey", recommendedKw: kw, needsHumanCheck: unsure };
}
