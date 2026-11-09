// REAL bill reader: Claude vision via the Anthropic Messages API (plain fetch, no SDK needed).
// Output is UNTRUSTED. The caller (lib/ai/index.ts) validates it with Zod, flags implausible values,
// and a person confirms every value beside the bill image before it is used.
import { BILL_SYSTEM_PROMPT } from "./prompt";
import type { BillReader } from "./schema";

const API_URL = "https://api.anthropic.com/v1/messages";
export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const CLAUDE_TIMEOUT_MS = 45_000;


const field = (type: "string" | "number") => ({
  type: ["object", "null"],
  properties: { value: { type }, confidence: { type: "number", minimum: 0, maximum: 1 } },
  required: ["value", "confidence"],
});

const TOOL = {
  name: "report_bill",
  description: "Report the values read from the electricity bill photo.",
  input_schema: {
    type: "object",
    properties: {
      photoQuality: { type: "string", enum: ["good", "poor", "unreadable"] },
      reason: { type: "string", maxLength: 200 },
      consumerNo: field("string"),
      tariff: field("string"),
      sanctionedLoadKw: field("number"),
      avgUnitsMonth: field("number"),
    },
    required: ["photoQuality", "consumerNo", "tariff", "sanctionedLoadKw", "avgUnitsMonth"],
  },
} as const;

export function claudeReader(opts: { apiKey: string; model?: string; fetchImpl?: typeof fetch }): BillReader {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    async extract(image, mime) {
      const res = await doFetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: opts.model ?? DEFAULT_MODEL,
          max_tokens: 700,
          temperature: 0,
          system: `${BILL_SYSTEM_PROMPT}
Always answer by calling the report_bill tool.`,
          tools: [TOOL],
          tool_choice: { type: "tool", name: TOOL.name },
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mime, data: image.toString("base64") } },
              { type: "text", text: "Read this electricity bill." },
            ],
          }],
        }),
        signal: AbortSignal.timeout(CLAUDE_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`reader http ${res.status}`); // never include the body: it can echo PII
      const json = (await res.json()) as { content?: { type: string; name?: string; input?: unknown }[] };
      const call = json.content?.find((c) => c.type === "tool_use" && c.name === TOOL.name);
      if (!call) throw new Error("reader returned no tool call");
      return call.input;
    },
  };
}
