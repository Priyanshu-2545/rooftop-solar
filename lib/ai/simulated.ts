// SIMULATED bill reader. Deterministic. NOT real AI/OCR (see docs/AI.md, A23).
// Maps the seeded sample bill images (by sha256) to canned values so every path is demoable
// with no API key: good, poor (blurry), unsure (ambiguous). Anything else is unreadable -> manual entry.
import { createHash } from "node:crypto";
import { SAMPLE_BILL_HASHES } from "./sample-manifest";
import type { BillExtraction, BillReader } from "./schema";

const good = (consumer: string, units: number, load: number): BillExtraction => ({
  photoQuality: "good",
  consumerNo: { value: consumer, confidence: 0.97 },
  tariff: { value: "LT-I Residential", confidence: 0.94 },
  sanctionedLoadKw: { value: load, confidence: 0.92 },
  avgUnitsMonth: { value: units, confidence: 0.95 },
});

const CANNED: Record<string, BillExtraction> = {
  "bill-good-340.png": good("410012345601", 340, 5),
  "bill-good-210.png": good("410012345602", 210, 3),
  "bill-good-85.png": good("410012345603", 85, 2),
  "bill-blurry.png": {
    photoQuality: "poor",
    reason: "The photo is blurry.",
    consumerNo: null, tariff: null, sanctionedLoadKw: null, avgUnitsMonth: null,
  },
  "bill-ambiguous.png": {
    photoQuality: "good",
    consumerNo: { value: "41001234560?", confidence: 0.55 }, // last digit unreadable
    tariff: { value: "LT-I Residential", confidence: 0.9 },
    sanctionedLoadKw: null,
    avgUnitsMonth: { value: 400, confidence: 0.6 },
  },
};

export const UNREADABLE: BillExtraction = {
  photoQuality: "unreadable",
  reason: "We could not read this bill automatically.",
  consumerNo: null, tariff: null, sanctionedLoadKw: null, avgUnitsMonth: null,
};

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export const simulatedReader: BillReader = {
  async extract(image) {
    const file = SAMPLE_BILL_HASHES[sha256(image)];
    return (file && CANNED[file]) || UNREADABLE;
  },
};
