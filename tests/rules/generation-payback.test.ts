import { describe, expect, it } from "vitest";
import { computeGeneration } from "@/lib/rules/generation";
import { computePayback, lifetimeSavings, yearlySavings } from "@/lib/rules/payback";

describe("computeGeneration", () => {
  it("3 kW × 1,400 = 4,200 units", () => expect(computeGeneration(3)).toBe(4200));
  it("uses an edited units-per-kW setting", () => expect(computeGeneration(3, 1500)).toBe(4500));
  it("handles half kW", () => expect(computeGeneration(2.5)).toBe(3500));
  it("rejects bad input", () => {
    expect(() => computeGeneration(0)).toThrow();
    expect(() => computeGeneration(3, 0)).toThrow(RangeError);
  });
});

describe("payback", () => {
  // Sample: 3 kW at ₹58,000/kW = ₹1,74,000 gross; subsidy ₹78,000 -> net ₹96,000 (ASSUMPTION A9 prices)
  const net = 9_600_000;
  const savings = yearlySavings(4200, 800); // ₹8/unit
  it("yearly savings = 4,200 × ₹8 = ₹33,600", () => expect(savings).toBe(3_360_000));
  it("payback on the sample numbers is 2.9 years", () => {
    expect(computePayback({ netCostPaise: net, yearlySavingsPaise: savings })).toBe(2.9);
  });
  it("returns null (not Infinity) for zero or negative savings", () => {
    expect(computePayback({ netCostPaise: net, yearlySavingsPaise: 0 })).toBeNull();
    expect(computePayback({ netCostPaise: net, yearlySavingsPaise: -5 })).toBeNull();
  });
  it("payback is 0 when net cost is 0", () => {
    expect(computePayback({ netCostPaise: 0, yearlySavingsPaise: savings })).toBe(0);
  });
  it("rounds to one decimal", () => {
    expect(computePayback({ netCostPaise: 1000, yearlySavingsPaise: 300 })).toBe(3.3);
  });
  it("rejects non-integer money and negative cost", () => {
    expect(() => computePayback({ netCostPaise: 10.5, yearlySavingsPaise: 100 })).toThrow(RangeError);
    expect(() => computePayback({ netCostPaise: -1, yearlySavingsPaise: 100 })).toThrow(RangeError);
    expect(() => yearlySavings(-1, 800)).toThrow(RangeError);
  });
  it("has no float drift: results are always integers", () => {
    expect(Number.isInteger(yearlySavings(4199, 833))).toBe(true);
  });
  it("25-year savings is flat by default (A8)", () => {
    expect(lifetimeSavings({ yearlySavingsPaise: savings, years: 25 })).toBe(savings * 25);
  });
  it("applies escalation in basis points and stays an integer", () => {
    const total = lifetimeSavings({ yearlySavingsPaise: 1000, years: 2, escalationBp: 1000 });
    expect(total).toBe(1000 + 1100);
    expect(() => lifetimeSavings({ yearlySavingsPaise: 1000, years: -1 })).toThrow(RangeError);
  });
});
