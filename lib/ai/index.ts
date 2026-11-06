// The adapter. Swap `reader` for a real OCR/vision provider; nothing else changes.
// Output is UNTRUSTED: schema-validated here, plausibility-flagged, then a person confirms.
import { flagFields } from "./plausibility";
import { billExtractionSchema, type BillExtraction, type BillReader } from "./schema";
import { simulatedReader, UNREADABLE } from "./simulated";

export const READER_BACKEND = "simulated";
const TIMEOUT_MS = 8000;
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
): Promise<ExtractOutcome> {
  if (!(ALLOWED_MIME as readonly string[]).includes(mime)) throw new RangeError("Unsupported image type");
  if (image.length === 0 || image.length > MAX_IMAGE_BYTES) throw new RangeError("Image is empty or too large");
  try {
    const raw = await Promise.race([reader.extract(image, mime), timeout(TIMEOUT_MS)]);
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
