// Server-side validation of the lead form. Liberal input (Postel), strict output. Pure.
import { z } from "zod";
import type { MessageKey } from "@/lib/i18n/make-t";
import { isPincode, parseNumber, sqmToSqft, toAsciiDigits } from "@/lib/normalize";
import { rupeesToPaiseRounded } from "@/lib/rules/money";

export const ROOF_TYPES = ["rcc_flat", "sloped_tin", "sloped_tile", "other"] as const;
export const CONSENT_TEXT_VERSION = "v1"; // bump when the consent wording changes

const raw = z
  .object({
    name: z.string().max(60).optional(),
    ownerType: z.enum(["owner", "tenant"]),
    roofType: z.enum(ROOF_TYPES),
    roofArea: z.string().max(20),
    areaUnit: z.enum(["sqft", "sqm"]).default("sqft"),
    bill: z.string().max(20),
    pincode: z.string().max(10),
    consent: z.literal("on"),
    idempotencyKey: z.string().min(8).max(64).regex(/^[\w-]+$/),
  })
  .strict(); // reject unknown fields

export type LeadInput = {
  name?: string;
  ownerType: "owner" | "tenant";
  roofType: (typeof ROOF_TYPES)[number];
  roofAreaSqft: number;
  monthlyBillPaise: number;
  pincode: string;
  idempotencyKey: string;
};
export type LeadErrors = Partial<Record<"ownerType" | "roofType" | "roofArea" | "bill" | "pincode" | "consent" | "photo" | "idempotencyKey", MessageKey>>;

const field: Record<string, keyof LeadErrors> = {
  ownerType: "ownerType", roofType: "roofType", roofArea: "roofArea", bill: "bill", pincode: "pincode", consent: "consent", idempotencyKey: "idempotencyKey",
};

export function parseLeadForm(input: Record<string, unknown>): { ok: true; data: LeadInput } | { ok: false; errors: LeadErrors } {
  const parsed = raw.safeParse(input);
  const errors: LeadErrors = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = field[String(issue.path[0])];
      if (!key || errors[key]) continue;
      errors[key] = key === "consent" ? "lead.err.consent" : key === "roofArea" ? "lead.err.area" : key === "bill" ? "lead.err.bill" : key === "pincode" ? "lead.err.pincode" : "lead.err.required";
    }
    if (Object.keys(errors).length === 0) errors.ownerType = "lead.err.required";
    // still validate the numeric fields we can, so the user sees all problems at once
  }
  const d = parsed.success ? parsed.data : null;
  const areaNum = parseNumber(String((input.roofArea as string) ?? ""));
  const sqft = areaNum === null ? null : (d?.areaUnit ?? (input.areaUnit === "sqm" ? "sqm" : "sqft")) === "sqm" ? sqmToSqft(areaNum) : Math.round(areaNum);
  if (sqft === null || sqft < 20 || sqft > 100_000) errors.roofArea = "lead.err.area";
  const billNum = parseNumber(String((input.bill as string) ?? ""));
  if (billNum === null || billNum < 1 || billNum > 1_000_000) errors.bill = "lead.err.bill";
  const pin = toAsciiDigits(String((input.pincode as string) ?? "")).trim();
  if (!isPincode(pin)) errors.pincode = "lead.err.pincode";
  if (Object.keys(errors).length > 0 || !d || sqft === null || billNum === null) return { ok: false, errors };
  return {
    ok: true,
    data: {
      name: d.name?.trim().replace(/\s+/g, " ") || undefined,
      ownerType: d.ownerType, roofType: d.roofType, roofAreaSqft: sqft,
      monthlyBillPaise: rupeesToPaiseRounded(billNum), pincode: pin, idempotencyKey: d.idempotencyKey,
    },
  };
}
