// The adapter. Swap `reader` for a real OCR/vision provider; nothing else changes.
// Output is UNTRUSTED: schema-validated here, plausibility-flagged, then a person confirms.
import { flagFields } from "./plausibility";
import { billExtractionSchema, type BillExtraction, type BillReader } from "./schema";
import { claudeReader, CLAUDE_TIMEOUT_MS, DEFAULT_MODEL } from "./claude";
import { DEFAULT_GEMINI_MODEL, GEMINI_TIMEOUT_MS, geminiReader } from "./gemini";
import { simulatedReader, UNREADABLE } from "./simulated";

const TIMEOUT_MS = 8000; // simulated reader; the real reader brings its own (longer) limit

/**
 * Real vision reader, chosen by env. AI_PROVIDER=gemini|anthropic forces one; otherwise Gemini (free tier) if
 * GEMINI_API_KEY is set, else Claude if ANTHROPIC_API_KEY is set, else the deterministic simulated reader.
 */
export function getReader(): { reader: BillReader; backend: string; timeoutMs: number } {
  const gemini = process.env.GEMINI_API_KEY;
  const claude = process.env.ANTHROPIC_API_KEY;
  const want = process.env.AI_PROVIDER;
  if (gemini && want !== "anthropic") {
    const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    return { reader: geminiReader({ apiKey: gemini, model }), backend: `gemini:${model}`, timeoutMs: GEMINI_TIMEOUT_MS + 2000 };
  }
  if (claude && want !== "gemini") {
    const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
    return { reader: claudeReader({ apiKey: claude, model }), backend: `claude:${model}`, timeoutMs: CLAUDE_TIMEOUT_MS + 2000 };
  }
  return { reader: simulatedReader, backend: "simulated", timeoutMs: TIMEOUT_MS };
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

export type ExtractOutcome = {
  extraction: BillExtraction;
  flags: ReturnType<typeof flagFields>;
  failed: boolean; // reader threw / timed out / returned invalid JSON
};

function timeout(ms: number): Promise<never> {
  return new Promise((_, rej) => setTimeout(() => rej(new Error("reader timeout")), ms));
}

export async function extractBill(
  image: Buffer,
  mime: string,
  reader: BillReader = simulatedReader,
  timeoutMs: number = TIMEOUT_MS,
): Promise<ExtractOutcome> {
  if (!(ALLOWED_MIME as readonly string[]).includes(mime)) throw new RangeError("Unsupported image type");
  if (image.length === 0 || image.length > MAX_IMAGE_BYTES) throw new RangeError("Image is empty or too large");
  try {
    const raw = await Promise.race([reader.extract(image, mime), timeout(timeoutMs)]);
    const parsed = billExtractionSchema.safeParse(raw);
    if (!parsed.success) {
      return { extraction: { ...UNREADABLE, reason: "The reader returned something we cannot use." }, flags: {}, failed: true };
    }
    return { extraction: parsed.data, flags: flagFields(parsed.data), failed: false };
  } catch (e) {
    // Log only the reason (e.g. "reader http 401"), never the image or any extracted value.
    console.error("bill reader failed:", e instanceof Error ? e.message : "unknown");
    // API down / timeout: never dead-end, go to manual entry.
    return { extraction: UNREADABLE, flags: {}, failed: true };
  }
}
