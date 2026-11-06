import { describe, expect, it } from "vitest";
import {
  assertPaise,
  formatINR,
  mulPaise,
  percentOfPaise,
  rupeesToPaise,
  rupeesToPaiseRounded,
} from "@/lib/rules/money";

describe("money", () => {
  it("converts whole rupees to paise", () => expect(rupeesToPaise(78000)).toBe(7_800_000));
  it("rejects fractional rupees in strict converter", () => {
    expect(() => rupeesToPaise(1.5)).toThrow(RangeError);
  });
  it("rounds typed rupee decimals without float drift", () => {
    expect(rupeesToPaiseRounded(0.1 + 0.2)).toBe(30);
    expect(rupeesToPaiseRounded(3200.5)).toBe(320_050);
    expect(() => rupeesToPaiseRounded(NaN)).toThrow(RangeError);
  });
  it("assertPaise rejects non-integers", () => {
    expect(() => assertPaise(10.5)).toThrow(RangeError);
    expect(() => assertPaise(100)).not.toThrow();
  });
  it("multiplies exactly", () => {
    expect(mulPaise(5_500_000, 3)).toBe(16_500_000);
    expect(() => mulPaise(100, 1.5)).toThrow(RangeError);
  });
  it("computes percentages in basis points", () => {
    expect(percentOfPaise(9_600_000, 1000)).toBe(960_000);
    expect(() => percentOfPaise(100, 1.5)).toThrow(RangeError);
  });
  it("formats with Indian grouping", () => {
    expect(formatINR(12_500_000).replace(/\s/g, "")).toBe("₹1,25,000");
    expect(formatINR(12_345).replace(/\s/g, "")).toBe("₹123.45");
  });
});
