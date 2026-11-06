import { describe, expect, it } from "vitest";
import { computeSubsidy, InvalidKwError, type SubsidyRule } from "@/lib/rules/subsidy";
import { RuleOverlapError } from "@/lib/rules/effective";
import { d, residentialRule } from "./fixtures";

const on = d("2026-11-06");
const sub = (kw: number, rules: SubsidyRule[] = [residentialRule], customerType: "residential" | "commercial" = "residential", date = on) =>
  computeSubsidy({ kw, customerType, on: date, rules });

describe("computeSubsidy (seeded residential rule)", () => {
  it.each([
    [1, 3_000_000],
    [2, 6_000_000],
    [3, 7_800_000],
    [5, 7_800_000],
    [10, 7_800_000],
    [0.5, 1_500_000],
    [1.5, 4_500_000],
    [2.5, 6_900_000],
  ])("%s kW -> %s paise", (kw, expected) => {
    expect(sub(kw).subsidyPaise).toBe(expected);
  });

  it("3 kW = 30,000×2 + 18,000 = ₹78,000 and reports the cap reached", () => {
    const r = sub(3);
    expect(r.subsidyPaise).toBe(7_800_000);
    expect(r.capReached).toBe(true);
    expect(r.ruleId).toBe("sub-res-2024");
    expect(r.warning).toBeNull();
  });
  it("1 kW does not reach the cap", () => expect(sub(1).capReached).toBe(false));

  it.each([0, -1, NaN, Infinity, 0.3, 2.75])("rejects invalid size %s", (kw) => {
    expect(() => sub(kw)).toThrow(InvalidKwError);
  });

  it("gives no subsidy and a warning for commercial customers (A10)", () => {
    const r = sub(3, [residentialRule], "commercial");
    expect(r).toMatchObject({ subsidyPaise: 0, ruleId: null, warning: "no_rule_for_customer_type" });
  });
  it("gives no subsidy and a warning before any rule exists", () => {
    const r = sub(3, [residentialRule], "residential", d("2023-12-31"));
    expect(r).toMatchObject({ subsidyPaise: 0, ruleId: null, warning: "no_rule_on_date" });
  });

  it("picks the right row when the scheme changes by date (boundary day uses new row)", () => {
    const oldRule: SubsidyRule = { ...residentialRule, id: "old", effectiveTo: d("2027-04-01") };
    const newRule: SubsidyRule = { ...residentialRule, id: "new", capPaise: 5_000_000, effectiveFrom: d("2027-04-01") };
    const rules = [oldRule, newRule];
    expect(sub(3, rules, "residential", d("2027-03-31"))).toMatchObject({ ruleId: "old", subsidyPaise: 7_800_000 });
    expect(sub(3, rules, "residential", d("2027-04-01"))).toMatchObject({ ruleId: "new", subsidyPaise: 5_000_000 });
  });

  it("throws on overlapping rule data instead of guessing", () => {
    const clash: SubsidyRule = { ...residentialRule, id: "clash", effectiveFrom: d("2025-01-01") };
    expect(() => sub(3, [residentialRule, clash])).toThrow(RuleOverlapError);
  });
});
