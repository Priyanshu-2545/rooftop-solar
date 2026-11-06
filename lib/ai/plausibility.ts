import type { BillExtraction, BillFieldKey } from "./schema";

export type Flag = "implausible" | "bad_format" | "missing";
export const SURE_THRESHOLD = 0.85; // >= sure, below = "check this"

// ASSUMPTION A27: consumer numbers are 10-14 digits.
export function flagFields(x: BillExtraction): Partial<Record<BillFieldKey, Flag>> {
  const flags: Partial<Record<BillFieldKey, Flag>> = {};
  if (!x.consumerNo) flags.consumerNo = "missing";
  else if (!/^\d{10,14}$/.test(x.consumerNo.value)) flags.consumerNo = "bad_format";
  if (!x.tariff) flags.tariff = "missing";
  if (!x.sanctionedLoadKw) flags.sanctionedLoadKw = "missing";
  else if (x.sanctionedLoadKw.value <= 0 || x.sanctionedLoadKw.value > 100) flags.sanctionedLoadKw = "implausible";
  if (!x.avgUnitsMonth) flags.avgUnitsMonth = "missing";
  else if (x.avgUnitsMonth.value <= 0 || x.avgUnitsMonth.value > 5000) flags.avgUnitsMonth = "implausible";
  return flags;
}

export function isSure(x: BillExtraction, key: BillFieldKey): boolean {
  const f = x[key];
  return f !== null && f.confidence >= SURE_THRESHOLD;
}
