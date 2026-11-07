// Project tracker logic (db-injected). Stage changes, documents, public status tokens.
import { createHash, randomBytes } from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { auditLog, documents, leads, projectEvents, projectStages, projects, quotes, users } from "@/db/schema";
import { ForbiddenError, canViewProject } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/data/leads";
import { sendToLeadOwner } from "@/lib/messaging/provider";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/image";
import { canMoveForward } from "./stuck";

export const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex");

export type ProjectRow = typeof projects.$inferSelect & { lead: typeof leads.$inferSelect };

/** Ownership checked here, in one place. Null for anything the user may not see. */
export async function getProjectFor(db: Db, user: SessionUser | null, id: string): Promise<ProjectRow | null> {
  if (!user || !isUuid(id)) return null;
  const [row] = await db.select({ p: projects, lead: leads }).from(projects)
    .innerJoin(quotes, eq(quotes.id, projects.quoteId)).innerJoin(leads, eq(leads.id, quotes.leadId)).where(eq(projects.id, id)).limit(1);
  return row && canViewProject(user, row.lead) ? { ...row.p, lead: row.lead } : null;
}

export type MoveResult = { ok: true; messageBody: string | null } | { ok: false; reason: "bad_stage" | "not_forward" };

export async function moveStage(db: Db, p: { user: SessionUser; projectId: string; toStage: string; note: string | null; now: Date; origin: string }): Promise<MoveResult> {
  if (p.user.role !== "sales") throw new ForbiddenError();
  const project = await getProjectFor(db, p.user, p.projectId);
  if (!project) throw new ForbiddenError();
  const stages = await db.select().from(projectStages).orderBy(asc(projectStages.order));
  const from = stages.find((s) => s.code === project.stageCode);
  const to = stages.find((s) => s.code === p.toStage);
  if (!to) return { ok: false, reason: "bad_stage" };
  if (!canMoveForward(from, to)) return { ok: false, reason: "not_forward" };

  await db.update(projects).set({ stageCode: to.code, stageEnteredAt: p.now }).where(eq(projects.id, project.id));
  await db.insert(projectEvents).values({ projectId: project.id, stageCode: to.code, note: p.note, actorUserId: p.user.id, at: p.now });
  await db.insert(auditLog).values({ actorUserId: p.user.id, action: "project.stage_changed", entity: "project", entityId: project.id, meta: { from: from?.code, to: to.code } });

  const [owner] = await db.select({ lang: users.language }).from(users).where(eq(users.id, project.lead.ownerUserId)).limit(1);
  const lang = owner?.lang ?? "en";
  const label = lang === "mr" ? to.labelMr : lang === "hi" ? to.labelHi : to.labelEn;
  const next = lang === "mr" ? to.nextMr : lang === "hi" ? to.nextHi : to.nextEn;
  const msg = await sendToLeadOwner(db, { leadId: project.lead.id, template: `stage:${to.code}`, key: "msg.stage", vars: { stage: label, next, link: `${p.origin}/projects/${project.id}` } });
  return { ok: true, messageBody: msg?.body ?? null };
}

// ---- documents ----
export class DocumentError extends Error {
  constructor(public code: "empty" | "too_large" | "bad_type") { super(`Document rejected: ${code}`); }
}
function sniffDoc(b: Buffer): { mime: string } | null {
  if (b.length >= 5 && b.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf" };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg" };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png" };
  return null;
}
export async function addDocument(db: Db, p: { user: SessionUser; projectId: string; kind: string; filename: string; data: Buffer; now: Date }) {
  if (p.user.role !== "sales") throw new ForbiddenError();
  const project = await getProjectFor(db, p.user, p.projectId);
  if (!project) throw new ForbiddenError();
  if (p.data.length === 0) throw new DocumentError("empty");
  if (p.data.length > MAX_UPLOAD_BYTES) throw new DocumentError("too_large");
  const sniffed = sniffDoc(p.data); // never trust the declared type
  if (!sniffed) throw new DocumentError("bad_type");
  const safeName = p.filename.replace(/[^\w.\- ]/g, "_").slice(0, 80) || "document";
  const [doc] = await db.insert(documents).values({
    projectId: project.id, kind: p.kind.slice(0, 40), filename: safeName, storageKey: randomBytes(24).toString("base64url"),
    data: p.data, mime: sniffed.mime, uploadedBy: p.user.id, at: p.now,
  }).returning({ id: documents.id });
  await db.insert(auditLog).values({ actorUserId: p.user.id, action: "document.uploaded", entity: "project", entityId: project.id, meta: { kind: p.kind } });
  return doc.id;
}
export async function getDocumentFor(db: Db, user: SessionUser | null, id: string) {
  if (!user || !isUuid(id)) return null;
  const [row] = await db.select({ d: documents, lead: leads }).from(documents)
    .innerJoin(projects, eq(projects.id, documents.projectId)).innerJoin(quotes, eq(quotes.id, projects.quoteId))
    .innerJoin(leads, eq(leads.id, quotes.leadId)).where(eq(documents.id, id)).limit(1);
  return row && canViewProject(user, row.lead) ? row.d : null;
}

// ---- public status link (token: >=128-bit random, stored hashed, revocable) ----
export async function createStatusToken(db: Db, p: { user: SessionUser; projectId: string }): Promise<string> {
  if (p.user.role !== "sales") throw new ForbiddenError();
  const project = await getProjectFor(db, p.user, p.projectId);
  if (!project) throw new ForbiddenError();
  const token = randomBytes(32).toString("base64url"); // 256 bits; shown once, never stored
  await db.update(projects).set({ statusTokenHash: sha256Hex(token), tokenRevokedAt: null }).where(eq(projects.id, project.id));
  await db.insert(auditLog).values({ actorUserId: p.user.id, action: "status_token.created", entity: "project", entityId: project.id });
  return token;
}
export async function revokeStatusToken(db: Db, p: { user: SessionUser; projectId: string; now: Date }) {
  if (p.user.role !== "sales") throw new ForbiddenError();
  const project = await getProjectFor(db, p.user, p.projectId);
  if (!project) throw new ForbiddenError();
  await db.update(projects).set({ tokenRevokedAt: p.now }).where(eq(projects.id, project.id));
  await db.insert(auditLog).values({ actorUserId: p.user.id, action: "status_token.revoked", entity: "project", entityId: project.id });
}

export type PublicStatus =
  | { state: "ok"; firstName: string; stageCode: string; stageEnteredAt: Date; timeline: { stageCode: string; at: Date }[]; documentNames: string[] }
  | { state: "revoked" }
  | { state: "unknown" };

/** Minimal data only: first name, stage, timeline, document NAMES. Never phone, consumer number or notes. */
export async function getPublicStatus(db: Db, token: string): Promise<PublicStatus> {
  if (!/^[\w-]{20,100}$/.test(token)) return { state: "unknown" };
  const [row] = await db.select({ p: projects, name: users.name }).from(projects)
    .innerJoin(quotes, eq(quotes.id, projects.quoteId)).innerJoin(leads, eq(leads.id, quotes.leadId)).innerJoin(users, eq(users.id, leads.ownerUserId))
    .where(eq(projects.statusTokenHash, sha256Hex(token))).limit(1);
  if (!row) return { state: "unknown" };
  if (row.p.tokenRevokedAt) return { state: "revoked" };
  const events = await db.select({ stageCode: projectEvents.stageCode, at: projectEvents.at }).from(projectEvents).where(eq(projectEvents.projectId, row.p.id)).orderBy(asc(projectEvents.at));
  const docs = await db.select({ filename: documents.filename }).from(documents).where(eq(documents.projectId, row.p.id)).orderBy(desc(documents.at));
  return { state: "ok", firstName: row.name.split(" ")[0], stageCode: row.p.stageCode, stageEnteredAt: row.p.stageEnteredAt, timeline: events, documentNames: docs.map((d) => d.filename) };
}
