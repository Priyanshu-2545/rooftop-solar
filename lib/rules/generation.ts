// Yearly generation. Fixed formula, editable setting (ASSUMPTION A6: 1,400 units/kW/year).
import { assertValidKw } from "./subsidy";

export const DEFAULT_UNITS_PER_KW_YEAR = 1400;

export function computeGeneration(kw: number, unitsPerKwYear: number = DEFAULT_UNITS_PER_KW_YEAR): number {
  assertValidKw(kw);
  if (!Number.isFinite(unitsPerKwYear) || unitsPerKwYear <= 0) {
    throw new RangeError("unitsPerKwYear must be positive");
  }
  return Math.round(kw * unitsPerKwYear);
}
