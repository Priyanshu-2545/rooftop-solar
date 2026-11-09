// Gemini vision bill reader (free tier available from Google AI Studio). Plain fetch, no SDK.
// Same contract as the Claude reader: output is UNTRUSTED and goes through Zod, plausibility flags and human confirmation.
import { BILL_SYSTEM_PROMPT } from "./prompt";
import type { BillReader } from "./schema";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"; // override with GEMINI_MODEL if Google renames it
export const GEMINI_TIMEOUT_MS = 45_000;

const FORMAT = `Reply with ONLY a JSON object of exactly this shape (null for a field you cannot read):
{"photoQuality":"good|poor|unreadable","reason":"short text, only if not good",
"consumerNo":{"value":"digits","confidence":0.0}|null,
"tariff":{"value":"text","confidence":0.0}|null,
"sanctionedLoadKw":{"value":0,"confidence":0.0}|null,
"avgUnitsMonth":{"value":0,"confidence":0.0}|null}`;

export function geminiReader(opts: { apiKey: string; model?: string; fetchImpl?: typeof fetch }): BillReader {
  const doFetch = opts.fetchImpl ?? fetch;
  const model = opts.model ?? DEFAULT_GEMINI_MODEL;
  return {
    async extract(image, mime) {
      const res = await doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": opts.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${BILL_SYSTEM_PROMPT}\n${FORMAT}` }] },
          contents: [{ role: "user", parts: [{ text: "Read this electricity bill." }, { inline_data: { mime_type: mime, data: image.toString("base64") } }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 700 },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`reader http ${res.status}`); // never include the body: it can echo PII
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (!text) throw new Error("reader returned no text");
      return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    },
  };
}
