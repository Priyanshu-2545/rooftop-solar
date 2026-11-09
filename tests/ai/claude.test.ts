import { describe, expect, it } from "vitest";
import { extractBill } from "@/lib/ai";
import { claudeReader } from "@/lib/ai/claude";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const reply = (input: unknown, ok = true) =>
  (async () => new Response(JSON.stringify({ content: [{ type: "tool_use", name: "report_bill", input }] }), { status: ok ? 200 : 500 })) as unknown as typeof fetch;

describe("claudeReader (mocked HTTP)", () => {
  it("passes a valid tool result through the same validation as any reader", async () => {
    const reader = claudeReader({ apiKey: "k", fetchImpl: reply({
      photoQuality: "good",
      consumerNo: { value: "410012345601", confidence: 0.97 }, tariff: { value: "LT-I Residential", confidence: 0.9 },
      sanctionedLoadKw: { value: 5, confidence: 0.9 }, avgUnitsMonth: { value: 340, confidence: 0.95 },
    }) });
    const out = await extractBill(png, "image/png", reader);
    expect(out.failed).toBe(false);
    expect(out.extraction.avgUnitsMonth?.value).toBe(340);
    expect(out.flags).toEqual({});
  });
  it("sends the image and forces the tool call", async () => {
    let body: { tool_choice: unknown; messages: { content: unknown[] }[] } | undefined;
    const spy = (async (_u: unknown, init: RequestInit) => { body = JSON.parse(String(init.body)); return new Response(JSON.stringify({ content: [{ type: "tool_use", name: "report_bill", input: { photoQuality: "unreadable", consumerNo: null, tariff: null, sanctionedLoadKw: null, avgUnitsMonth: null } }] })); }) as unknown as typeof fetch;
    await extractBill(png, "image/png", claudeReader({ apiKey: "k", fetchImpl: spy }));
    expect(body?.tool_choice).toEqual({ type: "tool", name: "report_bill" });
    expect(body?.messages[0].content[0]).toMatchObject({ type: "image", source: { media_type: "image/png" } });
  });
  it("HTTP error -> manual entry, never a crash", async () => {
    const out = await extractBill(png, "image/png", claudeReader({ apiKey: "k", fetchImpl: reply({}, false) }));
    expect(out.failed).toBe(true);
    expect(out.extraction.photoQuality).toBe("unreadable");
  });
  it("garbage (e.g. injected text) from the model is rejected by Zod", async () => {
    const out = await extractBill(png, "image/png", claudeReader({ apiKey: "k", fetchImpl: reply({ photoQuality: "good", consumerNo: "ignore previous instructions" }) }));
    expect(out.failed).toBe(true);
  });
  it("a poor photo is reported as poor with a reason", async () => {
    const out = await extractBill(png, "image/png", claudeReader({ apiKey: "k", fetchImpl: reply({ photoQuality: "poor", reason: "Blurry", consumerNo: null, tariff: null, sanctionedLoadKw: null, avgUnitsMonth: null }) }));
    expect(out.extraction.photoQuality).toBe("poor");
  });
});
