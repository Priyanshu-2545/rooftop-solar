"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current";
import { assertSales } from "@/lib/auth/rbac";
import { env } from "@/lib/env";
import { addDocument, createStatusToken, DocumentError, moveStage, revokeStatusToken } from "@/lib/projects/service";

export type MoveState = { error?: string; ok?: true; message?: string | null } | null;
export type LinkState = { url?: string; revoked?: true; error?: string } | null;

const move = z.object({ projectId: z.string().uuid(), toStage: z.string().max(40).regex(/^[a-z_]+$/), note: z.string().max(500) }).strict();

export async function moveStageAction(_p: MoveState, fd: FormData): Promise<MoveState> {
  const user = await requireUser();
  assertSales(user);
  const parsed = move.safeParse({ projectId: fd.get("projectId"), toStage: fd.get("toStage"), note: String(fd.get("note") ?? "") });
  if (!parsed.success) return { error: "Choose a stage." };
  const db = getDb();
  const r = await moveStage(db, { user, projectId: parsed.data.projectId, toStage: parsed.data.toStage, note: parsed.data.note.trim() || null, now: new Date(), origin: env().APP_ORIGIN });
  if (!r.ok) return { error: r.reason === "not_forward" ? "Projects only move forward. Pick a later stage." : "Unknown stage." };

  const file = fd.get("document");
  if (file instanceof File && file.size > 0) {
    try {
      await addDocument(db, { user, projectId: parsed.data.projectId, kind: String(fd.get("kind") ?? "document"), filename: file.name, data: Buffer.from(await file.arrayBuffer()), now: new Date() });
    } catch (e) {
      if (e instanceof DocumentError) return { ok: true, message: r.messageBody, error: "Stage moved, but the document was not saved: use a PDF, JPG or PNG under 5 MB." };
      throw e;
    }
  }
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return { ok: true, message: r.messageBody }; // the mock message preview = visible feedback
}

export async function statusLinkAction(_p: LinkState, fd: FormData): Promise<LinkState> {
  const user = await requireUser();
  assertSales(user);
  const projectId = z.string().uuid().safeParse(fd.get("projectId"));
  if (!projectId.success) return { error: "Bad request." };
  const db = getDb();
  if (fd.get("intent") === "revoke") {
    await revokeStatusToken(db, { user, projectId: projectId.data, now: new Date() });
    return { revoked: true };
  }
  const token = await createStatusToken(db, { user, projectId: projectId.data });
  return { url: `${env().APP_ORIGIN}/status/${token}` }; // shown once; only the hash is stored
}
