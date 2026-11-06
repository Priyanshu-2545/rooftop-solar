// Every read of a lead goes through here so ownership is checked in ONE place (deny by default; IDOR-safe).
// A homeowner asking for someone else's lead gets null, which pages render as 404 (no existence leak).
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { billExtractions, billUploads, leads } from "@/db/schema";
import { canViewLead } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID.test(s);

export type LeadRow = typeof leads.$inferSelect;

export async function getLeadFor(db: Db, user: SessionUser | null, id: string): Promise<LeadRow | null> {
  if (!user || !isUuid(id)) return null;
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return lead && canViewLead(user, lead) ? lead : null;
}

export async function getBillState(db: Db, leadId: string) {
  const uploads = await db.select().from(billUploads).where(eq(billUploads.leadId, leadId)).orderBy(desc(billUploads.attemptNo));
  const latest = uploads[0] ?? null;
  const [extraction] = latest
    ? await db.select().from(billExtractions).where(eq(billExtractions.uploadId, latest.id)).limit(1)
    : [];
  return { latest, extraction: extraction ?? null, attempts: uploads.length };
}

export async function getUploadFor(db: Db, user: SessionUser | null, uploadId: string) {
  if (!user || !isUuid(uploadId)) return null;
  const [row] = await db
    .select({ upload: billUploads, ownerUserId: leads.ownerUserId })
    .from(billUploads).innerJoin(leads, eq(leads.id, billUploads.leadId))
    .where(and(eq(billUploads.id, uploadId))).limit(1);
  return row && canViewLead(user, { ownerUserId: row.ownerUserId }) ? row.upload : null;
}
