# AI part (honest version)

**Bill reading uses Claude vision when `ANTHROPIC_API_KEY` is set (`lib/ai/claude.ts`); without the key it falls back to a deterministic simulated reader** so the demo and tests work offline. The backend used is stored with every extraction (`bill_extractions.backend`). No accuracy number is claimed: measure it on real bills before relying on it.

The real reader forces a structured tool call, sends the cleaned, upright, downscaled JPEG (EXIF/GPS already stripped), and treats the reply as untrusted: Zod validation, plausibility flags, then a person confirms every value beside the image. Text inside a photo cannot change the outcome because the model only returns fixed fields and a person confirms them. Failures (HTTP error, timeout, invalid output) go to manual entry, never a dead end. The consumer number leaves our system to the AI provider: disclose it (DPDP).

## What exists
1. **Simulated bill reader** (`lib/ai/simulated.ts`): deterministic. It hashes the upload (sha256) and maps the seeded sample bill images to canned values: a *good* bill, a *blurry* bill (→ poor photo), an *ambiguous* bill (low-confidence fields). Any other image → `unreadable` → manual entry with fields editable beside the image.
2. **Rule-based lead score** (`lib/rules/score.ts`): plain `if` rules, no model.

## Adapter interface
```ts
extractBill(image: Buffer, mime: string): Promise<BillExtraction>
type Field<T> = { value: T; confidence: number /*0..1*/ } | null
type BillExtraction = {
  photoQuality: 'good' | 'poor' | 'unreadable'; reason?: string;
  consumerNo: Field<string>; tariff: Field<string>;
  sanctionedLoadKw: Field<number>; avgUnitsMonth: Field<number>;
}
```
Validated with Zod (`lib/ai/schema.ts`).

## Confidence handling
≥ 0.85 "sure"; < 0.85 "check this" (highlighted). A person must confirm before scoring. Unconfirmed or low-confidence data caps the band at Medium and flags "needs human check".

## Failure modes
| Situation | What happens |
|---|---|
| Poor photo | Friendly re-upload tips; after 3 tries → manual entry |
| Unsure fields | Highlighted "check this"; user confirms or edits |
| Partial extraction | Missing fields highlighted, editable |
| Implausible (units > 5,000; load > 100 kW; bad consumer-no format) | Flagged, must be fixed or confirmed |
| Reader throws / times out / invalid JSON | Treated as unreadable → manual entry |
| Unknown image | Unreadable → manual entry |
| Wrong type / too large | Validation error before reading |
| Low score | Never rejects; next step becomes "short call" |

## Why scoring is rule-based
Transparent reasons, explainable to the homeowner and MD, testable, no training data available, Occam's razor.

## Boundaries
AI never decides price, subsidy, size or acceptance. Subsidy comes from the dated table; generation from the fixed formula. Extracted vs confirmed values are stored so accuracy can be measured later.

## Evaluation
Tested on a small labelled set of the seeded sample bills only (good/poor/ambiguous/unknown paths); this proves the *flow*, not real-world OCR accuracy. Limits: the simulated reader cannot read new bills; the real reader's accuracy on real MSEDCL bills in Marathi/English still has to be measured.
