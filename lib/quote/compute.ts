// Quote option maths = composition of the pure rules engine. No I/O. The AI never touches this.
import { NoEffectiveRuleError, selectEffectiveRule, type Dated } from "@/lib/rules/effective";
import { computeGeneration } from "@/lib/rules/generation";
import { computePayback, lifetimeSavings, yearlySavings } from "@/lib/rules/payback";
import type { QuoteSettings } from "@/lib/rules/settings";
import { maxKwForRoof } from "@/lib/rules/size";
import { computeSubsidy, type CustomerType, type SubsidyRule, type SubsidyWarning } from "@/lib/rules/subsidy";

export type Tier = "standard" | "premium";
export interface PriceRule extends Dated {
  id: string;
  kw: number;
  tier: Tier;
  pricePaise: number;
}

export interface OptionOutput {
  kw: number;
  tier: Tier;
  grossPaise: number;
  subsidyPaise: number;
  netPaise: number;
  generationUnits: number;
  yearlySavingsPaise: number;
  paybackYears: number | null;
  lifetimeSavingsPaise: number;
  priceRuleId: string;
  subsidyRuleId: string | null;
  subsidyWarning: SubsidyWarning | null;
  capReached: boolean;
}

export class NoPriceError extends Error {
  constructor(kw: number, tier: Tier) {
    super(`No price for ${kw} kW (${tier}) on this date`);
    this.name = "NoPriceError";
  }
}

export const LIFETIME_YEARS = 25;

export function computeOption(p: {
  kw: number;
  tier: Tier;
  customerType: CustomerType;
  on: Date;
  priceRules: readonly PriceRule[];
  subsidyRules: readonly SubsidyRule[];
  settings: QuoteSettings;
}): OptionOutput {
  const series = p.priceRules.filter((r) => r.kw === p.kw && r.tier === p.tier);
  let price: PriceRule;
  try {
    price = selectEffectiveRule(series, p.on);
  } catch (e) {
    if (e instanceof NoEffectiveRuleError) throw new NoPriceError(p.kw, p.tier);
    throw e;
  }
  const sub = computeSubsidy({ kw: p.kw, customerType: p.customerType, on: p.on, rules: p.subsidyRules });
  const generationUnits = computeGeneration(p.kw, p.settings.unitsPerKwYear);
  const netPaise = Math.max(price.pricePaise - sub.subsidyPaise, 0);
  const yearly = yearlySavings(generationUnits, p.settings.tariffPaisePerUnit);
  return {
    kw: p.kw,
    tier: p.tier,
    grossPaise: price.pricePaise,
    subsidyPaise: sub.subsidyPaise,
    netPaise,
    generationUnits,
    yearlySavingsPaise: yearly,
    paybackYears: computePayback({ netCostPaise: netPaise, yearlySavingsPaise: yearly }),
    lifetimeSavingsPaise: lifetimeSavings({ yearlySavingsPaise: yearly, years: LIFETIME_YEARS, escalationBp: p.settings.escalationBp }),
    priceRuleId: price.id,
    subsidyRuleId: sub.ruleId,
    subsidyWarning: sub.warning,
    capReached: sub.capReached,
  };
}

/**
 * Up to 3 default option sizes around the recommendation (-1, 0, +1 kW), never more than the roof allows
 * and never below 1 kW. If the roof is smaller than the recommendation we say so via `roofLimited`.
 */
export function suggestSizes(recommendedKw: number, roofAreaSqft: number, maxKw = 10): { sizes: number[]; roofLimited: boolean } {
  const roofMax = Math.floor(maxKwForRoof(roofAreaSqft));
  const ceiling = Math.min(maxKw, Math.max(roofMax, 1));
  const roofLimited = recommendedKw > ceiling;
  const centre = Math.min(recommendedKw, ceiling);
  const sizes = [centre - 1, centre, centre + 1].filter((k) => k >= 1 && k <= ceiling);
  return { sizes, roofLimited };
}
