// Lead business logic (no next/* imports, so it is integration-testable).
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { auditLog, billExtractions, billUploads, leads, users } from "@/db/schema";
import { extractBill, getReader } from "@/lib/ai";
import { SAMPLE_BILL_HASHES } from "@/lib/ai/sample-manifest";
import { sha256, simulatedReader } from "@/lib/ai/simulated";
import { billExtractionSchema, BILL_FIELDS, type BillExtraction, type BillFieldKey } from "@/lib/ai/schema";
import { ForbiddenError } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";
import { getBillState, getLeadFor } from "@/lib/data/leads";
import { sendToLeadOwner } from "@/lib/messaging/provider";
import { scoreLead } from "@/lib/rules/score";
import { checkAndReencode } from "@/lib/storage/image";
import { inferCustomerType, resolveConfirmation, type Decision, type Typed } from "./confirm";
import { CONSENT_TEXT_VERSION, type LeadInput } from "./validate";

export const MAX_UPLOAD_ATTEMPTS = 3;
export const DEFAULT_NAME = "New customer";
const DUP_WINDOW_MS = 7 * 86_400_000; // A19
const BAND_SCORE = { high: 80, medium: 50, low: 20 } as const;

async function nextHumanId(db: Db): Promise<string> {
  const [r] = await db.select({ n: sql<number>`coalesce(max(cast(substring(${leads.humanId} from 4) as int)), 30000)` }).from(leads);
  return `LD-${r.n + 1}`;
}

async function storeUpload(db: Db, leadId: string, original: Buffer, attemptNo: number, now: Date) {
  const { data, mimeIn } = await checkAndReencode(original);
  // Real AI reads the cleaned, upright, downscaled copy; the simulated reader needs the ORIGINAL bytes (sample-hash mapping).
  // The bundled sample bills always use the free deterministic reader (instant, no API cost, same result every time).
  const isSample = sha256(original) in SAMPLE_BILL_HASHES;
  const { reader, backend, timeoutMs } = isSample ? { ...getReader(), reader: simulatedReader, backend: "simulated" } : getReader();
  const real = backend !== "simulated";
  const { extraction } = await extractBill(real ? data : original, real ? "image/jpeg" : mimeIn, reader, timeoutMs);
  const [upload] = await db.insert(billUploads).values({
    leadId, storageKey: randomBytes(24).toString("base64url"), data, mime: "image/jpeg", bytes: data.length,
    sha256: createHash("sha256").update(original).digest("hex"),
    qualityFlag: extraction.photoQuality === "good" ? "good" : extraction.photoQuality === "poor" ? "poor" : "unknown",
    attemptNo, uploadedAt: now,
  }).returning();
  const conf = Object.fromEntries(BILL_FIELDS.flatMap((k) => (extraction[k] ? [[k, extraction[k]!.confidence]] : [])));
  await db.insert(billExtractions).values({
    uploadId: upload.id, backend, rawJson: extraction,
    consumerNo: extraction.consumerNo?.value ?? null, tariff: extraction.tariff?.value ?? null,
    sanctionedLoadKw: extraction.sanctionedLoadKw ? String(extraction.sanctionedLoadKw.value) : null,
    avgUnitsMonth: extraction.avgUnitsMonth ? Math.round(extraction.avgUnitsMonth.value) : null,
    confidenceJson: conf, status: extraction.photoQuality === "poor" ? "rejected_photo" : "pending",
  });
  return { upload, extraction };
}

export async function createLead(db: Db, p: { user: SessionUser; input: LeadInput; original: Buffer; now: Date }) {
  const { user, input, now } = p;
  // idempotency: a double-submit returns the same lead
  const [same] = await db.select({ id: leads.id }).from(leads)
    .where(and(eq(leads.ownerUserId, user.id), eq(leads.idempotencyKey, input.idempotencyKey))).limit(1);
  if (same) return { leadId: same.id, duplicate: false };
  // duplicate: same phone (owner) + pincode within 7 days -> link instead of creating (A19)
  const [dup] = await db.select({ id: leads.id }).from(leads)
    .where(and(eq(leads.ownerUserId, user.id), eq(leads.pincode, input.pincode), gt(leads.createdAt, new Date(now.getTime() - DUP_WINDOW_MS))))
    .orderBy(desc(leads.createdAt)).limit(1);
  if (dup) return { leadId: dup.id, duplicate: true };

  await checkAndReencode(p.original); // fail fast on a bad file, before creating anything
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [lead] = await db.insert(leads).values({
        humanId: await nextHumanId(db), ownerUserId: user.id, ownerType: input.ownerType, roofType: input.roofType,
        roofAreaSqft: input.roofAreaSqft, monthlyBillPaise: input.monthlyBillPaise, pincode: input.pincode,
        consentAt: now, consentTextVersion: CONSENT_TEXT_VERSION, status: "bill_review",
        idempotencyKey: input.idempotencyKey, createdAt: now,
      }).returning();
      await storeUpload(db, lead.id, p.original, 1, now);
      // use the name they gave, but never overwrite a name someone already set
      if (input.name && user.name === DEFAULT_NAME) await db.update(users).set({ name: input.name }).where(eq(users.id, user.id));
      await db.insert(auditLog).values({ actorUserId: user.id, action: "lead.created", entity: "lead", entityId: lead.id, meta: { humanId: lead.humanId } });
      return { leadId: lead.id, duplicate: false };
    } catch (e) {
      if ((e as { code?: string }).code === "23505" && attempt < 4) continue; // human id raced: retry
      throw e;
    }
  }
  throw new Error("could not allocate lead id");
}

export type ReuploadResult = { ok: true } | { ok: false; reason: "max_attempts" | "not_found" };
export async function reuploadBill(db: Db, p: { user: SessionUser; leadId: string; original: Buffer; now: Date }): Promise<ReuploadResult> {
  const lead = await getLeadFor(db, p.user, p.leadId);
  if (!lead) return { ok: false, reason: "not_found" };
  const { attempts } = await getBillState(db, lead.id);
  if (attempts >= MAX_UPLOAD_ATTEMPTS) return { ok: false, reason: "max_attempts" };
  await storeUpload(db, lead.id, p.original, attempts + 1, p.now); // first upload is retained; latest is used
  return { ok: true };
}

/** The reader's stored output, or null when the photo gave nothing usable (manual entry). */
export function readerOutput(raw: unknown): BillExtraction | null {
  const parsed = billExtractionSchema.safeParse(raw);
  return parsed.success && parsed.data.photoQuality === "good" ? parsed.data : null;
}

export type ConfirmResult =
  | { ok: true; band: "high" | "medium" | "low" }
  | { ok: false; errors: Partial<Record<BillFieldKey, import("@/lib/i18n/make-t").MessageKey>> };

export async function confirmBill(
  db: Db,
  p: { user: SessionUser; leadId: string; decisions: Partial<Record<BillFieldKey, Decision>>; typed: Typed; now: Date },
): Promise<ConfirmResult> {
  const lead = await getLeadFor(db, p.user, p.leadId);
  if (!lead) throw new ForbiddenError();
  const { extraction: row } = await getBillState(db, lead.id);
  const reader = row ? readerOutput(row.rawJson) : null;

  const res = resolveConfirmation({ extraction: reader, decisions: p.decisions, typed: p.typed });
  if (!res.ok) return res;
  const v = res.values;
  const customerType = inferCustomerType(lead.monthlyBillPaise, v.sanctionedLoadKw);
  const score = scoreLead({
    ownerType: lead.ownerType, billPaise: lead.monthlyBillPaise, unitsPerMonth: v.avgUnitsMonth,
    roofAreaSqft: lead.roofAreaSqft, roofType: lead.roofType, confirmedBill: true, lowConfidence: res.lowConfidence,
  });
  const firstTime = lead.status === "bill_review";
  const previous = row?.confirmedJson as Partial<Record<BillFieldKey, unknown>> | null;

  if (row) {
    await db.update(billExtractions).set({
      consumerNo: v.consumerNo, tariff: v.tariff, sanctionedLoadKw: String(v.sanctionedLoadKw), avgUnitsMonth: Math.round(v.avgUnitsMonth),
      confirmedJson: v, status: res.edited ? "edited" : "confirmed", confirmedBy: p.user.id, confirmedAt: p.now,
    }).where(eq(billExtractions.id, row.id));
  }
  await db.update(leads).set({
    unitsPerMonth: Math.round(v.avgUnitsMonth), customerType, score: BAND_SCORE[score.band], scoreBand: score.band,
    scoreReasons: score.reasons, nextStep: score.nextStep, recommendedKw: score.recommendedKw === null ? null : String(score.recommendedKw),
    needsHumanCheck: score.needsHumanCheck || res.implausible, status: firstTime ? "scored" : lead.status,
  }).where(eq(leads.id, lead.id));

  // audit trail: field NAMES that changed, never the values (no PII in logs)
  const changed = previous ? BILL_FIELDS.filter((k) => String(previous[k]) !== String(v[k])) : [];
  await db.insert(auditLog).values({
    actorUserId: p.user.id, action: firstTime ? "bill.confirmed" : "bill.edited", entity: "lead", entityId: lead.id,
    meta: { edited: res.edited, lowConfidence: res.lowConfidence, changedFields: changed, byRole: p.user.role },
  });
  if (firstTime) {
    await sendToLeadOwner(db, {
      leadId: lead.id, template: "lead_received", key: "msg.leadReceived", vars: { id: lead.humanId },
      keyVars: { step: score.nextStep === "survey" ? "msg.leadStep.survey" : "msg.leadStep.call" },
    });
  }
  return { ok: true, band: score.band };
}

