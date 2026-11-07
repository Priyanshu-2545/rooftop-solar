import { describe, expect, it } from "vitest";
import { ageLabel, daysBetween, formatDateIST, maskConsumerNo } from "@/lib/sales/format";

describe("format helpers", () => {
  it("masks consumer numbers to the last 4", () => {
    expect(maskConsumerNo("410012345601")).toBe("••••••••5601");
    expect(maskConsumerNo("123")).toBe("••••");
    expect(maskConsumerNo(null)).toBe("—");
  });
  it("labels age in m/h/d", () => {
    const now = new Date("2026-11-07T10:00:00Z");
    expect(ageLabel(new Date("2026-11-07T09:30:00Z"), now)).toBe("30m");
    expect(ageLabel(new Date("2026-11-07T04:00:00Z"), now)).toBe("6h");
    expect(ageLabel(new Date("2026-11-02T10:00:00Z"), now)).toBe("5d");
  });
  it("formats dates in Asia/Kolkata (a late-UTC time rolls to the next IST day)", () => {
    expect(formatDateIST(new Date("2026-11-06T20:00:00Z"))).toContain("7");
  });
  it("counts whole days", () => expect(daysBetween(new Date("2026-11-01T00:00:00Z"), new Date("2026-11-09T12:00:00Z"))).toBe(8));
});
