import { describe, expect, it } from "vitest";
import { parseLeadForm } from "@/lib/leads/validate";

const good = {
  ownerType: "owner", roofType: "rcc_flat", roofArea: "400", areaUnit: "sqft", bill: "3200", pincode: "440010",
  consent: "on", idempotencyKey: "abcd-1234-efgh",
};

describe("parseLeadForm", () => {
  it("accepts a clean submission and stores paise", () => {
    const r = parseLeadForm(good);
    expect(r).toMatchObject({ ok: true, data: { roofAreaSqft: 400, monthlyBillPaise: 320_000, pincode: "440010" } });
  });
  it("is liberal: commas, rupee sign, Devanagari digits, sq m", () => {
    const r = parseLeadForm({ ...good, bill: "₹3,200", roofArea: "३०", areaUnit: "sqm", pincode: "४४०००१" });
    expect(r).toMatchObject({ ok: true, data: { monthlyBillPaise: 320_000, roofAreaSqft: 323, pincode: "440001" } });
  });
  it.each([
    [{ bill: "-5" }, "bill"], [{ bill: "0" }, "bill"], [{ bill: "abc" }, "bill"], [{ bill: "99999999" }, "bill"],
    [{ pincode: "4400" }, "pincode"], [{ pincode: "44001A" }, "pincode"],
    [{ roofArea: "5" }, "roofArea"], [{ roofArea: "" }, "roofArea"],
    [{ consent: undefined }, "consent"], [{ ownerType: "landlord" }, "ownerType"], [{ idempotencyKey: "x" }, "idempotencyKey"],
  ])("rejects %j", (patch, field) => {
    const r = parseLeadForm({ ...good, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[field as keyof typeof r.errors]).toBeTruthy();
  });
  it("rejects unknown fields (strict)", () => {
    expect(parseLeadForm({ ...good, isAdmin: "true" }).ok).toBe(false);
  });
  it("reports every bad field at once", () => {
    const r = parseLeadForm({ ...good, bill: "x", pincode: "1" });
    expect(r.ok === false && Object.keys(r.errors).sort()).toEqual(["bill", "pincode"]);
  });
  it("a non-vidarbha pincode is NOT blocked (soft hint only, A13)", () => {
    expect(parseLeadForm({ ...good, pincode: "560001" }).ok).toBe(true);
  });
});
