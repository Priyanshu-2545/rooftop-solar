// Payback and savings. Pure, integer paise.
// ASSUMPTION A7: flat blended tariff (default ₹8/unit). ASSUMPTION A8: 0% yearly escalation by default.
import { assertPaise, type Paise } from "./money";

export function yearlySavings(generationUnits: number, tariffPaisePerUnit: Paise): Paise {
  if (!Number.isSafeInteger(generationUnits) || generationUnits < 0) {
    throw new RangeError("generationUnits must be a non-negative integer");
  }
  assertPaise(tariffPaisePerUnit);
  return generationUnits * tariffPaisePerUnit;
}

/** Years to recover net cost, one decimal. Returns null when savings are zero/negative (never Infinity). */
export function computePayback(input: { netCostPaise: Paise; yearlySavingsPaise: Paise }): number | null {
  assertPaise(input.netCostPaise);
  assertPaise(input.yearlySavingsPaise);
  if (input.netCostPaise < 0) throw new RangeError("netCostPaise must not be negative");
  if (input.yearlySavingsPaise <= 0) return null;
  return Math.round((input.netCostPaise * 10) / input.yearlySavingsPaise) / 10;
}

/** Total savings over `years`, with escalation in basis points per year (0 = flat). */
export function lifetimeSavings(input: {
  yearlySavingsPaise: Paise;
  years: number;
  escalationBp?: number;
}): Paise {
  assertPaise(input.yearlySavingsPaise);
  const bp = input.escalationBp ?? 0;
  if (!Number.isSafeInteger(input.years) || input.years < 0) throw new RangeError("years must be a whole number");
  let year = input.yearlySavingsPaise;
  let total = 0;
  for (let i = 0; i < input.years; i++) {
    total += year;
    year = Math.round((year * (10000 + bp)) / 10000);
  }
  return total;
}
