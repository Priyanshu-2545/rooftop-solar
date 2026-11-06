import { describe, expect, it } from "vitest";
import { maxKwForRoof, monthlyUnitsToKw, requiredRoofArea, roofFits } from "@/lib/rules/size";
import { scoreLead, type ScoreInput } from "@/lib/rules/score";

describe("monthlyUnitsToKw", () => {
  it("340 units -> 3 kW", () => expect(monthlyUnitsToKw(340)).toBe(3));
  it("85 units -> 1 kW", () => expect(monthlyUnitsToKw(85)).toBe(1));
  it("boundaries: 0, negative and NaN give null", () => {
    expect(monthlyUnitsToKw(0)).toBeNull();
    expect(monthlyUnitsToKw(-4)).toBeNull();
    expect(monthlyUnitsToKw(NaN)).toBeNull();
  });
  it("rounds to nearest whole kW with a minimum of 1", () => {
    expect(monthlyUnitsToKw(10)).toBe(1);
    expect(monthlyUnitsToKw(116)).toBe(1); // 0.99
    expect(monthlyUnitsToKw(175)).toBe(2); // 1.5 -> 2
  });
  it("follows an edited units-per-kW setting", () => expect(monthlyUnitsToKw(340, 1020)).toBe(4));
});

describe("roof fit", () => {
  it("needs ~100 sq ft per kW", () => expect(requiredRoofArea(3)).toBe(300));
  it("fits at exactly the needed area", () => {
    expect(roofFits(300, 3)).toBe(true);
    expect(roofFits(299, 3)).toBe(false);
  });
  it("suggests the largest whole/half kW that fits", () => {
    expect(maxKwForRoof(250)).toBe(2.5);
    expect(maxKwForRoof(40)).toBe(0);
    expect(maxKwForRoof(NaN)).toBe(0);
  });
  it("rejects non-positive kW", () => expect(() => requiredRoofArea(0)).toThrow(RangeError));
});

const base: ScoreInput = {
  ownerType: "owner",
  billPaise: 320_000,
  unitsPerMonth: 340,
  roofAreaSqft: 400,
  roofType: "rcc_flat",
  confirmedBill: true,
};

describe("scoreLead: the three sample leads", () => {
  it("LD-30881 Prashant (owner, ₹3,200, 340 units) -> High, 3 kW, survey", () => {
    expect(scoreLead(base)).toMatchObject({ band: "high", recommendedKw: 3, nextStep: "survey" });
  });
  it("LD-30902 Rohit (tenant, ₹1,900, 210 units) -> Low (tenant), no kW, call", () => {
    const r = scoreLead({ ...base, ownerType: "tenant", billPaise: 190_000, unitsPerMonth: 210 });
    expect(r).toMatchObject({ band: "low", reasons: ["tenant"], recommendedKw: null, nextStep: "call" });
  });
  it("LD-30915 Ayesha (owner, ₹650, 85 units) -> Low (small bill), 1 kW, call", () => {
    const r = scoreLead({ ...base, billPaise: 65_000, unitsPerMonth: 85 });
    expect(r).toMatchObject({ band: "low", reasons: ["small_bill"], recommendedKw: 1, nextStep: "call" });
  });
});

describe("scoreLead: boundaries and safety", () => {
  it("₹2,500 and 250 units exactly is High", () => {
    expect(scoreLead({ ...base, billPaise: 250_000, unitsPerMonth: 250 }).band).toBe("high");
  });
  it("one unit short of 250 is Medium", () => {
    expect(scoreLead({ ...base, billPaise: 250_000, unitsPerMonth: 249 }).band).toBe("medium");
  });
  it("₹999 bill is Low, ₹1,000 is not", () => {
    expect(scoreLead({ ...base, billPaise: 99_900 }).band).toBe("low");
    expect(scoreLead({ ...base, billPaise: 100_000, unitsPerMonth: 150 }).band).toBe("medium");
  });
  it("99 units is Low (small bill) even with a big bill amount", () => {
    expect(scoreLead({ ...base, unitsPerMonth: 99 }).band).toBe("low");
  });
  it("strong bill but a small roof is Medium with a roof reason", () => {
    const r = scoreLead({ ...base, roofAreaSqft: 150 });
    expect(r).toMatchObject({ band: "medium", reasons: ["roof_too_small"], nextStep: "survey" });
  });
  it("unconfirmed bill caps High at Medium and asks for a human check", () => {
    const r = scoreLead({ ...base, confirmedBill: false });
    expect(r).toMatchObject({ band: "medium", needsHumanCheck: true });
    expect(r.reasons).toContain("needs_human_check");
  });
  it("low-confidence extraction caps High at Medium", () => {
    expect(scoreLead({ ...base, lowConfidence: true }).band).toBe("medium");
  });
  it("missing units on a mid bill gives Medium with a human check, never a crash", () => {
    const r = scoreLead({ ...base, billPaise: 150_000, unitsPerMonth: null, confirmedBill: false });
    expect(r).toMatchObject({ band: "medium", recommendedKw: null, needsHumanCheck: true });
  });
  it("a low score never rejects: every Low result routes to a call", () => {
    const lows = [
      scoreLead({ ...base, ownerType: "tenant" }),
      scoreLead({ ...base, billPaise: 65_000, unitsPerMonth: 85 }),
    ];
    for (const r of lows) {
      expect(r.band).toBe("low");
      expect(r.nextStep).toBe("call");
      expect(["survey", "call"]).toContain(r.nextStep);
    }
  });
});
