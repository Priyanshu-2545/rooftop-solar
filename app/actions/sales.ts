"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { auditLog, leads, surveys } from "@/db/schema";
import { requireUser } from "@/lib/auth/current";
import { assertSales, ForbiddenError } from "@/lib/auth/rbac";
import { getBillState, getLeadFor } from "@/lib/data/leads";
import { sendToLeadOwner } from "@/lib/messaging/provider";

export type SimpleState = { ok?: true; error?: string } | null;

const survey = z.object({
  leadId: z.string().uuid(),
  roofOk: z.enum(["yes", "no"]),
  usableArea: z.string().max(7).regex(/^\d*$/),
  shading: z.enum(["none", "some", "heavy"]),
  notes: z.string().max(1000),
}).strict();

export async function saveSurveyAction(_p: SimpleState, fd: FormData): Promise<SimpleState> {
  const user = await requireUser();
  assertSales(user);
  const parsed = survey.safeParse({
    leadId: fd.get("leadId"), roofOk: fd.get("roofOk"), usableArea: String(fd.get("usableArea") ?? ""),
    shading: fd.get("shading"), notes: String(fd.get("notes") ?? ""),
  });
  if (!parsed.success) return { error: "Please check the survey fields." };
  const d = parsed.data;
  const db = getDb();
  const lead = await getLeadFor(db, user, d.leadId);
  if (!lead) throw new ForbiddenError();
  const values = { roofOk: d.roofOk === "yes", usableAreaSqft: d.usableArea ? Number(d.usableArea) : null, shading: d.shading, notes: d.notes || null, surveyedBy: user.id };
  await db.insert(surveys).values({ leadId: lead.id, ...values }).onConflictDoUpdate({ target: surveys.leadId, set: { ...values, at: new Date() } });
  await db.update(leads).set({ status: "surveyed" }).where(eq(leads.id, lead.id));
  await db.insert(auditLog).values({ actorUserId: user.id, action: "survey.saved", entity: "lead", entityId: lead.id });
  revalidatePath(`/leads/${lead.id}`);
  return { ok: true };
}

const schedule = z.object({ leadId: z.string().uuid(), kind: z.enum(["call", "visit"]), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();

export async function scheduleAction(_p: SimpleState, fd: FormData): Promise<SimpleState> {
  const user = await requireUser();
  assertSales(user);
  const parsed = schedule.safeParse({ leadId: fd.get("leadId"), kind: fd.get("kind"), date: fd.get("date") });
  if (!parsed.success) return { error: "Choose a call or visit and a date." };
  const db = getDb();
  const lead = await getLeadFor(db, user, parsed.data.leadId);
  if (!lead) throw new ForbiddenError();
  const when = new Date(`${parsed.data.date}T00:00:00+05:30`);
  const dateText = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(when);
  await sendToLeadOwner(db, {
    leadId: lead.id, template: `schedule_${parsed.data.kind}`, key: "msg.visit", vars: { date: dateText },
    keyVars: { kind: parsed.data.kind === "call" ? "msg.kind.call" : "msg.kind.visit" },
  });
  if (lead.status === "scored" || lead.status === "new") await db.update(leads).set({ status: "contacted" }).where(eq(leads.id, lead.id));
  await db.insert(auditLog).values({ actorUserId: user.id, action: `schedule.${parsed.data.kind}`, entity: "lead", entityId: lead.id, meta: { date: parsed.data.date } });
  revalidatePath(`/leads/${lead.id}`);
  return { ok: true };
}

/** Unmasking personal data is an explicit, audit-logged action (DPDP minimisation). */
export async function revealConsumerAction(leadId: string): Promise<string | null> {
  const user = await requireUser();
  if (user.role !== "sales") return null;
  const db = getDb();
  const lead = await getLeadFor(db, user, leadId);
  if (!lead) return null;
  const { extraction } = await getBillState(db, lead.id);
  await db.insert(auditLog).values({ actorUserId: user.id, action: "consumer_no.revealed", entity: "lead", entityId: lead.id });
  return extraction?.consumerNo ?? null;
}

