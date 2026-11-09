// The adapter. Swap `reader` for a real OCR/vision provider; nothing else changes.
// Output is UNTRUSTED: schema-validated here, plausibility-flagged, then a person confirms.
import { flagFields } from "./plausibility";
import { billExtractionSchema, type BillExtraction, type BillReader } from "./schema";
import { claudeReader, CLAUDE_TIMEOUT_MS, DEFAULT_MODEL } from "./claude";
import { simulatedReader, UNREADABLE } from "./simulated";

const TIMEOUT_MS = 8000; // simulated reader; the real reader brings its own (longer) limit

/** Real Claude vision reader when ANTHROPIC_API_KEY is set, otherwise the deterministic simulated one. */
export function getReader(): { reader: BillReader; backend: string; timeoutMs: number } {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
    return { reader: claudeReader({ apiKey, model }), backend: `claude:${model}`, timeoutMs: CLAUDE_TIMEOUT_MS + 2000 };
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
  } catch {
    // API down / timeout: never dead-end, go to manual entry.
    return { extraction: UNREADABLE, flags: {}, failed: true };
  }
}
