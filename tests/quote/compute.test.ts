import { describe, expect, it } from "vitest";
import { computeOption, NoPriceError, suggestSizes, type PriceRule } from "@/lib/quote/compute";
import { DEFAULT_SETTINGS, pickSetting, resolveSettings } from "@/lib/rules/settings";
import { d, residentialRule } from "../rules/fixtures";

const price = (id: string, kw: number, tier: "standard" | "premium", rupees: number, from = "2024-01-01", to: string | null = null): PriceRule => ({
  id, kw, tier, pricePaise: rupees * 100, effectiveFrom: d(from), effectiveTo: to ? d(to) : null,
});
const prices = [price("p3s", 3, "standard", 165000), price("p3p", 3, "premium", 180000)];
const on = d("2026-11-06");
const opt = (kw: number, tier: "standard" | "premium" = "standard", over = {}) =>
  computeOption({ kw, tier, customerType: "residential", on, priceRules: prices, subsidyRules: [residentialRule], settings: DEFAULT_SETTINGS, ...over });

describe("computeOption", () => {
  it("3 kW standard: ₹1,65,000 - ₹78,000 = ₹87,000 net, 4,200 units, 2.6 yr payback", () => {
    const o = opt(3);
    expect(o).toMatchObject({
      grossPaise: 16_500_000, subsidyPaise: 7_800_000, netPaise: 8_700_000,
      generationUnits: 4200, yearlySavingsPaise: 3_360_000, paybackYears: 2.6, capReached: true,
    });
    expect(o.lifetimeSavingsPaise).toBe(3_360_000 * 25);
  });
  it("records which rule rows were used", () => {
    expect(opt(3)).toMatchObject({ priceRuleId: "p3s", subsidyRuleId: "sub-res-2024" });
  });
  it("commercial: no subsidy, net = gross, with a warning", () => {
    const o = opt(3, "standard", { customerType: "commercial" });
    expect(o).toMatchObject({ subsidyPaise: 0, netPaise: 16_500_000, subsidyWarning: "no_rule_for_customer_type" });
  });
  it("net never goes below zero", () => {
    const cheap = [price("c", 3, "standard", 50000)];
    expect(opt(3, "standard", { priceRules: cheap }).netPaise).toBe(0);
  });
  it("throws NoPriceError when no price row is effective", () => {
    expect(() => opt(4)).toThrow(NoPriceError);
    expect(() => opt(3, "standard", { on: d("2023-01-01") })).toThrow(NoPriceError);
  });
  it("price changes by date: boundary day uses the new price", () => {
    const rows = [price("old", 3, "standard", 165000, "2024-01-01", "2027-01-01"), price("new", 3, "standard", 170000, "2027-01-01")];
    expect(opt(3, "standard", { priceRules: rows, on: d("2026-12-31") }).priceRuleId).toBe("old");
    expect(opt(3, "standard", { priceRules: rows, on: d("2027-01-01") }).priceRuleId).toBe("new");
  });
  it("uses edited settings (tariff and generation)", () => {
    const o = opt(3, "standard", { settings: { unitsPerKwYear: 1500, tariffPaisePerUnit: 900, escalationBp: 0 } });
    expect(o.generationUnits).toBe(4500);
    expect(o.yearlySavingsPaise).toBe(4_050_000);
  });
});

describe("suggestSizes", () => {
  it("gives -1, 0, +1 around the recommendation", () => {
    expect(suggestSizes(3, 600)).toEqual({ sizes: [2, 3, 4], roofLimited: false });
  });
  it("never goes below 1 kW", () => expect(suggestSizes(1, 600).sizes).toEqual([1, 2]));
  it("limits to what the roof allows and flags it", () => {
    expect(suggestSizes(4, 250)).toEqual({ sizes: [1, 2], roofLimited: true });
  });
});

describe("settings", () => {
  const rows = [
    { key: "tariff_rate_paise_per_unit", value: "800", effectiveFrom: d("2024-01-01") },
    { key: "tariff_rate_paise_per_unit", value: "900", effectiveFrom: d("2026-06-01") },
  ];
  it("picks the latest effective value", () => {
    expect(pickSetting(rows, "tariff_rate_paise_per_unit", d("2026-05-31"))).toBe("800");
    expect(pickSetting(rows, "tariff_rate_paise_per_unit", d("2026-06-01"))).toBe("900");
    expect(pickSetting(rows, "nope", on)).toBeUndefined();
  });
  it("falls back to defaults and ignores junk values", () => {
    expect(resolveSettings([], on)).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings([{ key: "units_per_kw_year", value: "abc", effectiveFrom: d("2024-01-01") }], on).unitsPerKwYear).toBe(1400);
    expect(resolveSettings(rows, on).tariffPaisePerUnit).toBe(900);
  });
});
