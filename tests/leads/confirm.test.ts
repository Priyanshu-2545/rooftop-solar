import { describe, expect, it } from "vitest";
import { inferCustomerType, resolveConfirmation } from "@/lib/leads/confirm";
import type { BillExtraction } from "@/lib/ai/schema";

const sure: BillExtraction = {
  photoQuality: "good",
  consumerNo: { value: "410012345601", confidence: 0.97 },
  tariff: { value: "LT-I Residential", confidence: 0.94 },
  sanctionedLoadKw: { value: 5, confidence: 0.92 },
  avgUnitsMonth: { value: 340, confidence: 0.95 },
};
const allOk = { consumerNo: "ok", tariff: "ok", sanctionedLoadKw: "ok", avgUnitsMonth: "ok" } as const;

describe("resolveConfirmation", () => {
  it("accepting sure values keeps them, unedited, high confidence", () => {
    const r = resolveConfirmation({ extraction: sure, decisions: allOk, typed: {} });
    expect(r).toMatchObject({ ok: true, edited: false, lowConfidence: false, values: { avgUnitsMonth: 340 } });
  });
  it("ignores posted values for fields marked 'ok' (server is authoritative)", () => {
    const r = resolveConfirmation({ extraction: sure, decisions: allOk, typed: { avgUnitsMonth: "9999" } });
    expect(r.ok && r.values.avgUnitsMonth).toBe(340);
  });
  it("a fixed field uses the typed value and marks the extraction as edited", () => {
    const r2 = resolveConfirmation({ extraction: sure, decisions: { ...allOk, avgUnitsMonth: "fix" }, typed: { avgUnitsMonth: "310" } });
    expect(r2).toMatchObject({ ok: true, edited: true, values: { avgUnitsMonth: 310 } });
  });
  it("accepting a 'check this' value as-is stays low confidence; fixing it clears that", () => {
    const unsure: BillExtraction = { ...sure, avgUnitsMonth: { value: 400, confidence: 0.6 } };
    expect(resolveConfirmation({ extraction: unsure, decisions: allOk, typed: {} })).toMatchObject({ ok: true, lowConfidence: true });
    const fixed = resolveConfirmation({ extraction: unsure, decisions: { ...allOk, avgUnitsMonth: "fix" }, typed: { avgUnitsMonth: "400" } });
    expect(fixed).toMatchObject({ ok: true, lowConfidence: false });
  });
  it("missing fields must be typed", () => {
    const partial: BillExtraction = { ...sure, sanctionedLoadKw: null };
    const r = resolveConfirmation({ extraction: partial, decisions: allOk, typed: {} });
    expect(r).toEqual({ ok: false, errors: { sanctionedLoadKw: "bill.err.number" } });
  });
  it("manual entry (no extraction) validates every field and is low confidence (A28)", () => {
    const r = resolveConfirmation({ extraction: null, decisions: {}, typed: { consumerNo: "4100 1234 5601", tariff: "LT-I", sanctionedLoadKw: "3", avgUnitsMonth: "210" } });
    expect(r).toMatchObject({ ok: true, lowConfidence: true, edited: true, values: { consumerNo: "410012345601" } });
  });
  it("rejects a bad consumer number and an empty tariff", () => {
    const r = resolveConfirmation({ extraction: null, decisions: {}, typed: { consumerNo: "12", tariff: "", sanctionedLoadKw: "3", avgUnitsMonth: "210" } });
    expect(r).toEqual({ ok: false, errors: { consumerNo: "bill.err.consumer", tariff: "bill.err.text" } });
  });
  it("implausible values are accepted but flagged for a human check (never a dead end)", () => {
    const r = resolveConfirmation({ extraction: null, decisions: {}, typed: { consumerNo: "410012345601", tariff: "LT-V", sanctionedLoadKw: "150", avgUnitsMonth: "6000" } });
    expect(r).toMatchObject({ ok: true, implausible: true, lowConfidence: true });
  });
  it("rejects nonsense numbers", () => {
    const r = resolveConfirmation({ extraction: null, decisions: {}, typed: { consumerNo: "410012345601", tariff: "x", sanctionedLoadKw: "-3", avgUnitsMonth: "abc" } });
    expect(r.ok).toBe(false);
  });
});

describe("inferCustomerType (A29)", () => {
  it("big bill or load is commercial", () => {
    expect(inferCustomerType(880_000, 5)).toBe("commercial");
    expect(inferCustomerType(300_000, 12)).toBe("commercial");
    expect(inferCustomerType(320_000, 5)).toBe("residential");
  });
});
