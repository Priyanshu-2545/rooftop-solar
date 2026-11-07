"use server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current";
import { isDemo } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n/make-t";
import { SAMPLE_BILL_HASHES } from "@/lib/ai/sample-manifest";
import { BILL_FIELDS, type BillFieldKey } from "@/lib/ai/schema";
import type { Decision } from "@/lib/leads/confirm";
import { confirmBill, createLead, reuploadBill } from "@/lib/leads/service";
import { parseLeadForm, type LeadErrors } from "@/lib/leads/validate";
import { MAX_UPLOAD_BYTES, UploadError } from "@/lib/storage/image";

export type LeadFormState = { errors?: LeadErrors; server?: MessageKey } | null;
export type BillFormState = { errors?: Partial<Record<BillFieldKey, MessageKey>>; server?: MessageKey } | null;

const SAMPLE_FILES = new Set(Object.values(SAMPLE_BILL_HASHES));

/** Photo from the file input, or (DEMO_MODE only) one of the bundled sample bills. */
async function readPhoto(formData: FormData): Promise<{ buf: Buffer } | { error: MessageKey }> {
  const sample = formData.get("sample");
  if (isDemo() && typeof sample === "string" && sample) {
    if (!SAMPLE_FILES.has(sample)) return { error: "lead.err.photo" };
    return { buf: await readFile(path.join(process.cwd(), "samples", "bills", sample)) };
  }
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "lead.err.photo" };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "lead.err.photoSize" };
  return { buf: Buffer.from(await file.arrayBuffer()) };
}

const uploadErrorKey = (e: UploadError): MessageKey => (e.code === "too_large" ? "lead.err.photoSize" : e.code === "empty" ? "lead.err.photo" : "lead.err.photoType");

export async function createLeadAction(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const user = await requireUser();
  if (user.role !== "homeowner") return { server: "lead.err.server" };
  const parsed = parseLeadForm({
    name: String(formData.get("name") ?? "") || undefined, ownerType: formData.get("ownerType"), roofType: formData.get("roofType"), roofArea: formData.get("roofArea"),
    areaUnit: formData.get("areaUnit") ?? "sqft", bill: formData.get("bill"), pincode: formData.get("pincode"),
    consent: formData.get("consent") ?? undefined, idempotencyKey: formData.get("idempotencyKey"),
  });
  const photo = await readPhoto(formData);
  const errors: LeadErrors = parsed.ok ? {} : parsed.errors;
  if ("error" in photo) errors.photo = photo.error;
  if (!parsed.ok || "error" in photo) return { errors };

  let leadId: string;
  let duplicate = false;
  try {
    ({ leadId, duplicate } = await createLead(getDb(), { user, input: parsed.data, original: photo.buf, now: new Date() }));
  } catch (e) {
    if (e instanceof UploadError) return { errors: { photo: uploadErrorKey(e) } };
    console.error("createLead failed", e instanceof Error ? e.message : "unknown"); // no PII in logs
    return { server: "lead.err.server" };
  }
  redirect(`/leads/${leadId}/bill${duplicate ? "?dup=1" : ""}`);
}

export async function reuploadAction(_prev: BillFormState, formData: FormData): Promise<BillFormState> {
  const user = await requireUser();
  const leadId = z.string().uuid().safeParse(formData.get("leadId"));
  if (!leadId.success) return { server: "lead.err.server" };
  const photo = await readPhoto(formData);
  if ("error" in photo) return { server: photo.error };
  try {
    const r = await reuploadBill(getDb(), { user, leadId: leadId.data, original: photo.buf, now: new Date() });
    if (!r.ok && r.reason === "not_found") return { server: "lead.err.server" };
  } catch (e) {
    if (e instanceof UploadError) return { server: uploadErrorKey(e) };
    return { server: "lead.err.server" };
  }
  redirect(`/leads/${leadId.data}/bill`);
}

export async function confirmBillAction(_prev: BillFormState, formData: FormData): Promise<BillFormState> {
  const user = await requireUser();
  const leadId = z.string().uuid().safeParse(formData.get("leadId"));
  if (!leadId.success) return { server: "lead.err.server" };
  const decisions: Partial<Record<BillFieldKey, Decision>> = {};
  const typed: Partial<Record<BillFieldKey, string>> = {};
  const errors: Partial<Record<BillFieldKey, MessageKey>> = {};
  for (const k of BILL_FIELDS) {
    const d = formData.get(`decision_${k}`);
    if (d === "ok" || d === "fix") decisions[k] = d;
    const v = formData.get(`value_${k}`);
    if (typeof v === "string") typed[k] = v.slice(0, 80);
  }
  const needsChoice = formData.get("mode") === "review";
  if (needsChoice) {
    for (const k of BILL_FIELDS) if (!decisions[k]) errors[k] = "bill.err.choose";
    if (Object.keys(errors).length) return { errors };
  }
  try {
    const r = await confirmBill(getDb(), { user, leadId: leadId.data, decisions, typed, now: new Date() });
    if (!r.ok) return { errors: r.errors };
  } catch {
    return { server: "lead.err.server" };
  }
  redirect(user.role === "sales" ? `/leads/${leadId.data}` : `/leads/${leadId.data}`);
}
