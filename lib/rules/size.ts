// Size recommendation and roof fit. Pure.
import { DEFAULT_UNITS_PER_KW_YEAR } from "./generation";

// ASSUMPTION A12: ~100 sq ft of usable roof per kW.
export const SQFT_PER_KW = 100;

/**
 * ASSUMPTION A5: kW = units/month × 12 ÷ unitsPerKwYear, rounded to the NEAREST whole kW, minimum 1.
 * 340 -> 2.91 -> 3 kW;  85 -> 0.73 -> 1 kW.  Returns null for missing/invalid units.
 */
export function monthlyUnitsToKw(
  unitsPerMonth: number,
  unitsPerKwYear: number = DEFAULT_UNITS_PER_KW_YEAR,
): number | null {
  if (!Number.isFinite(unitsPerMonth) || unitsPerMonth <= 0) return null;
  return Math.max(1, Math.round((unitsPerMonth * 12) / unitsPerKwYear));
}

export function requiredRoofArea(kw: number): number {
  if (!Number.isFinite(kw) || kw <= 0) throw new RangeError("kw must be positive");
  return Math.round(kw * SQFT_PER_KW);
}

export function roofFits(roofAreaSqft: number, kw: number): boolean {
  return roofAreaSqft >= requiredRoofArea(kw);
}

/** Largest whole-or-half kW that fits the roof (0 if even 0.5 kW does not). Used to suggest a smaller system. */
export function maxKwForRoof(roofAreaSqft: number): number {
  if (!Number.isFinite(roofAreaSqft) || roofAreaSqft <= 0) return 0;
  return Math.floor((roofAreaSqft / SQFT_PER_KW) * 2) / 2;
}
