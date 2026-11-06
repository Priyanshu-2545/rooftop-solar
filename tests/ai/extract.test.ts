import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractBill } from "@/lib/ai";
import { flagFields, isSure } from "@/lib/ai/plausibility";
import type { BillExtraction } from "@/lib/ai/schema";

const sample = (f: string) => readFileSync(`samples/bills/${f}`);

describe("extractBill (simulated reader)", () => {
  it("good bill: 340 units, all fields sure", async () => {
    const { extraction, flags, failed } = await extractBill(sample("bill-good-340.png"), "image/png");
    expect(failed).toBe(false);
    expect(extraction.photoQuality).toBe("good");
    expect(extraction.avgUnitsMonth?.value).toBe(340);
    expect(isSure(extraction, "avgUnitsMonth")).toBe(true);
    expect(flags).toEqual({});
  });
  it("blurry bill: poor photo with a reason", async () => {
    const { extraction } = await extractBill(sample("bill-blurry.png"), "image/png");
    expect(extraction.photoQuality).toBe("poor");
    expect(extraction.reason).toBeTruthy();
  });
  it("ambiguous bill: low confidence, missing and bad-format fields are flagged", async () => {
    const { extraction, flags } = await extractBill(sample("bill-ambiguous.png"), "image/png");
    expect(isSure(extraction, "avgUnitsMonth")).toBe(false);
    expect(flags.sanctionedLoadKw).toBe("missing");
    expect(flags.consumerNo).toBe("bad_format");
  });
  it("unknown image falls back to manual entry (unreadable)", async () => {
    const { extraction } = await extractBill(Buffer.from("not a known bill"), "image/png");
    expect(extraction.photoQuality).toBe("unreadable");
    expect(extraction.consumerNo).toBeNull();
  });
  it("malformed reader output is rejected by Zod -> manual entry", async () => {
    const out = await extractBill(Buffer.from("x"), "image/png", { extract: async () => ({ photoQuality: "great" }) });
    expect(out.failed).toBe(true);
    expect(out.extraction.photoQuality).toBe("unreadable");
  });
  it("reader that throws (API down) -> manual entry", async () => {
    const out = await extractBill(Buffer.from("x"), "image/png", { extract: async () => { throw new Error("down"); } });
    expect(out.failed).toBe(true);
  });
  it("rejects wrong type and oversized/empty images before reading", async () => {
    await expect(extractBill(Buffer.from("x"), "application/pdf")).rejects.toThrow(RangeError);
    await expect(extractBill(Buffer.alloc(0), "image/png")).rejects.toThrow(RangeError);
    await expect(extractBill(Buffer.alloc(5 * 1024 * 1024 + 1), "image/png")).rejects.toThrow(RangeError);
  });
});

describe("flagFields plausibility", () => {
  const ok: BillExtraction = {
    photoQuality: "good",
    consumerNo: { value: "410012345601", confidence: 0.9 },
    tariff: { value: "LT-I", confidence: 0.9 },
    sanctionedLoadKw: { value: 5, confidence: 0.9 },
    avgUnitsMonth: { value: 340, confidence: 0.9 },
  };
  it("flags units > 5,000 and load > 100 kW", () => {
    const f = flagFields({ ...ok, avgUnitsMonth: { value: 5001, confidence: 1 }, sanctionedLoadKw: { value: 101, confidence: 1 } });
    expect(f).toEqual({ avgUnitsMonth: "implausible", sanctionedLoadKw: "implausible" });
  });
  it("flags zero/negative values and a missing tariff", () => {
    const f = flagFields({ ...ok, avgUnitsMonth: { value: 0, confidence: 1 }, tariff: null });
    expect(f).toEqual({ avgUnitsMonth: "implausible", tariff: "missing" });
  });
  it("accepts plausible values", () => expect(flagFields(ok)).toEqual({}));
});
