import { describe, expect, it } from "vitest";
import { isPincode, looksLikeVidarbha, normalizeConsumerNo, normalizePhone, parseNumber, sqmToSqft } from "@/lib/normalize";

describe("normalize (Postel's law)", () => {
  it.each(["9000000001", "+91 90000 00001", "+91-90000-00001", "09000000001", "९००००००००१"])("phone %s", (p) => {
    expect(normalizePhone(p)).toBe("+919000000001");
  });
  it.each(["12345", "5000000001", "abcdefghij", "+9190000"])("rejects bad phone %s", (p) => {
    expect(normalizePhone(p)).toBeNull();
  });
  it("parses rupee amounts", () => {
    expect(parseNumber("₹3,200")).toBe(3200);
    expect(parseNumber("३२००")).toBe(3200);
    expect(parseNumber("Rs. 650")).toBe(650);
    expect(parseNumber("-5")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });
  it("normalises consumer numbers incl. Devanagari digits", () => {
    expect(normalizeConsumerNo("४१० ००१-२३४५६०१")).toBe("410001234560" + "1");
  });
  it("validates pincode and gives a soft Vidarbha hint", () => {
    expect(isPincode("440001")).toBe(true);
    expect(isPincode("44001")).toBe(false);
    expect(looksLikeVidarbha("440001")).toBe(true);
    expect(looksLikeVidarbha("560001")).toBe(false);
  });
  it("converts sq m to sq ft", () => expect(sqmToSqft(30)).toBe(323));
});
