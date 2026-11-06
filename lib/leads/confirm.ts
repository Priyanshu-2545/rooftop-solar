// Turns "what the reader said" + "what the person confirmed/typed" into the values used for scoring.
// The reader's output is untrusted; the server decides what counts as confirmed. Pure.
import type { MessageKey } from "@/lib/i18n/make-t";
import { SURE_THRESHOLD } from "@/lib/ai/plausibility";
import { BILL_FIELDS, type BillExtraction, type BillFieldKey } from "@/lib/ai/schema";
import { normalizeConsumerNo, parseNumber } from "@/lib/normalize";

export type Decision = "ok" | "fix";
export type Typed = Partial<Record<BillFieldKey, string>>;
export type Confirmed = { consumerNo: string; tariff: string; sanctionedLoadKw: number; avgUnitsMonth: number };

export type Resolution =
  | { ok: true; values: Confirmed; edited: boolean; lowConfidence: boolean; implausible: boolean }
  | { ok: false; errors: Partial<Record<BillFieldKey, MessageKey>> };

// ASSUMPTION A28: manual entry (nothing was read from the photo) is treated as low confidence, so the
// band is capped at Medium and a person double-checks.
export function resolveConfirmation(p: {
  extraction: BillExtraction | null; // null = manual entry
  decisions: Partial<Record<BillFieldKey, Decision>>;
  typed: Typed;
}): Resolution {
  const errors: Partial<Record<BillFieldKey, MessageKey>> = {};
  const out: Partial<Confirmed> = {};
  let edited = false;
  let lowConfidence = p.extraction === null;

  for (const key of BILL_FIELDS) {
    const ex = p.extraction?.[key] ?? null;
    const decision: Decision = p.extraction === null || ex === null ? "fix" : (p.decisions[key] ?? "fix");
    if (decision === "ok" && ex) {
      // keep the READ value, ignore anything the client posted
      (out as Record<string, unknown>)[key] = ex.value;
      if (ex.confidence < SURE_THRESHOLD) lowConfidence = true; // person accepted something the reader was unsure about
      continue;
    }
    const text = (p.typed[key] ?? "").trim();
    if (key === "consumerNo") {
      const v = normalizeConsumerNo(text);
      if (!/^\d{10,14}$/.test(v)) { errors[key] = "bill.err.consumer"; continue; }
      out.consumerNo = v;
      if (ex?.value !== v) edited = true;
    } else if (key === "tariff") {
      if (text.length < 1 || text.length > 60) { errors[key] = "bill.err.text"; continue; }
      out.tariff = text;
      if (ex?.value !== text) edited = true;
    } else {
      const n = parseNumber(text);
      if (n === null || n <= 0 || n > 1_000_000) { errors[key] = "bill.err.number"; continue; }
      (out as Record<string, unknown>)[key] = n;
      if (ex?.value !== n) edited = true;
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const values = out as Confirmed;
  // Implausible (but possible, e.g. a small business): accepted, flagged, needs a human check. Never a dead end.
  const implausible = values.avgUnitsMonth > 5000 || values.sanctionedLoadKw > 100;
  return { ok: true, values, edited, lowConfidence: lowConfidence || implausible, implausible };
}

// ASSUMPTION A29: a very large bill or load is a small-business connection, so no residential subsidy.
export function inferCustomerType(billPaise: number, loadKw: number): "residential" | "commercial" {
  return billPaise >= 800_000 || loadKw > 10 ? "commercial" : "residential";
}
