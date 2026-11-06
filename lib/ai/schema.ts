import { z } from "zod";

const conf = z.number().min(0).max(1);
const field = <T extends z.ZodTypeAny>(v: T) => z.object({ value: v, confidence: conf }).nullable();

/** Output contract for ANY bill reader (simulated now, real OCR later). Untrusted until a person confirms. */
export const billExtractionSchema = z.object({
  photoQuality: z.enum(["good", "poor", "unreadable"]),
  reason: z.string().max(200).optional(),
  consumerNo: field(z.string().max(40)),
  tariff: field(z.string().max(60)),
  sanctionedLoadKw: field(z.number()),
  avgUnitsMonth: field(z.number()),
});

export type BillExtraction = z.infer<typeof billExtractionSchema>;
export type BillFieldKey = "consumerNo" | "tariff" | "sanctionedLoadKw" | "avgUnitsMonth";
export const BILL_FIELDS: BillFieldKey[] = ["consumerNo", "tariff", "sanctionedLoadKw", "avgUnitsMonth"];

export interface BillReader {
  extract(image: Buffer, mime: string): Promise<unknown>;
}
