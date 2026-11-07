import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { messages, projectEvents, projects, users } from "@/db/schema";
import { confirmBill, createLead } from "@/lib/leads/service";
import { acceptQuote, saveQuote } from "@/lib/quote/service";
import { addDocument, createStatusToken, DocumentError, getDocumentFor, getProjectFor, getPublicStatus, moveStage, revokeStatusToken } from "@/lib/projects/service";
import { ForbiddenError } from "@/lib/auth/rbac";
import { leadInput, makeUser, sampleBill, seedReference } from "../helpers/factories";
import { resetDb, testDb as db } from "../helpers/testdb";

const now = new Date("2026-11-07T10:00:00Z");
const ORIGIN = "http://localhost:3000";
const allOk = { consumerNo: "ok", tariff: "ok", sanctionedLoadKw: "ok", avgUnitsMonth: "ok" } as const;

async function projectFixture(lang: "en" | "mr" = "en") {
  const owner = await makeUser("homeowner", { language: lang, name: "Prashant Wankhede" });
  const sales = await makeUser("sales");
  const { leadId } = await createLead(db, { user: owner, input: leadInput(), original: sampleBill(), now });
  await confirmBill(db, { user: owner, leadId, decisions: allOk, typed: {}, now });
  const { quoteId } = (await saveQuote(db, { user: sales, leadId, selections: [{ kw: 3, tier: "standard" }], send: true, now, origin: ORIGIN })) as { quoteId: string };
  const a = await acceptQuote(db, { user: owner, quoteId, optionIndex: 0, idempotencyKey: "key-abcdefgh", now, origin: ORIGIN });
  return { owner, sales, projectId: (a as { projectId: string }).projectId };
}
const pdf = Buffer.from("%PDF-1.4 test");
beforeEach(async () => { await resetDb(); await seedReference(); });

describe("project access (IDOR)", () => {
  it("owner and sales see the project; another homeowner and anonymous do not", async () => {
    const { owner, sales, projectId } = await projectFixture();
    const other = await makeUser();
    expect(await getProjectFor(db, owner, projectId)).not.toBeNull();
    expect(await getProjectFor(db, sales, projectId)).not.toBeNull();
    expect(await getProjectFor(db, other, projectId)).toBeNull();
    expect(await getProjectFor(db, null, projectId)).toBeNull();
    expect(await getProjectFor(db, sales, "1 or 1=1")).toBeNull();
  });
  it("a homeowner can never move a stage, upload, or mint a link", async () => {
    const { owner, projectId } = await projectFixture();
    await expect(moveStage(db, { user: owner, projectId, toStage: "survey_done", note: null, now, origin: ORIGIN })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addDocument(db, { user: owner, projectId, kind: "x", filename: "a.pdf", data: pdf, now })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createStatusToken(db, { user: owner, projectId })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("moveStage", () => {
  it("records who/when/note, logs a mock message in the owner's language, and resets the stage clock", async () => {
    const { owner, sales, projectId } = await projectFixture("mr");
    const later = new Date(now.getTime() + 3 * 86_400_000);
    const r = await moveStage(db, { user: sales, projectId, toStage: "survey_done", note: "Roof is fine", now: later, origin: ORIGIN });
    expect(r.ok).toBe(true);
    const [p] = await db.select().from(projects);
    expect(p).toMatchObject({ stageCode: "survey_done" });
    expect(p.stageEnteredAt.getTime()).toBe(later.getTime());
    const ev = (await db.select().from(projectEvents).where(eq(projectEvents.stageCode, "survey_done")))[0];
    expect(ev).toMatchObject({ note: "Roof is fine", actorUserId: sales.id });
    const msg = (await db.select().from(messages).where(eq(messages.template, "stage:survey_done")))[0];
    expect(msg).toMatchObject({ toPhone: owner.phone, lang: "mr", status: "mock_sent" });
    expect(msg.body).toContain("पाहणी पूर्ण"); // Marathi stage name
    expect(msg.body).toContain(`/projects/${projectId}`);
  });
  it("refuses backward, same-stage and unknown-stage moves", async () => {
    const { sales, projectId } = await projectFixture();
    await moveStage(db, { user: sales, projectId, toStage: "design_approved", note: null, now, origin: ORIGIN });
    expect(await moveStage(db, { user: sales, projectId, toStage: "survey_done", note: null, now, origin: ORIGIN })).toEqual({ ok: false, reason: "not_forward" });
    expect(await moveStage(db, { user: sales, projectId, toStage: "design_approved", note: null, now, origin: ORIGIN })).toEqual({ ok: false, reason: "not_forward" });
    expect(await moveStage(db, { user: sales, projectId, toStage: "nope", note: null, now, origin: ORIGIN })).toEqual({ ok: false, reason: "bad_stage" });
  });
});

describe("documents", () => {
  it("stores a PDF and lets the owner (not another homeowner) read it", async () => {
    const { owner, sales, projectId } = await projectFixture();
    const id = await addDocument(db, { user: sales, projectId, kind: "design", filename: "design plan.pdf", data: pdf, now });
    expect((await getDocumentFor(db, owner, id))?.mime).toBe("application/pdf");
    expect(await getDocumentFor(db, await makeUser(), id)).toBeNull();
  });
  it("rejects forged, empty and oversized files and sanitises the filename", async () => {
    const { sales, projectId } = await projectFixture();
    const args = { user: sales, projectId, kind: "x", now };
    await expect(addDocument(db, { ...args, filename: "evil.pdf", data: Buffer.from("<script>1</script>") })).rejects.toMatchObject({ code: "bad_type" });
    await expect(addDocument(db, { ...args, filename: "a.pdf", data: Buffer.alloc(0) })).rejects.toBeInstanceOf(DocumentError);
    await expect(addDocument(db, { ...args, filename: "a.pdf", data: Buffer.concat([pdf, Buffer.alloc(5 * 1024 * 1024)]) })).rejects.toMatchObject({ code: "too_large" });
    const id = await addDocument(db, { ...args, filename: "../../etc/passwd<>.pdf", data: pdf });
    const [d] = await db.select().from((await import("@/db/schema")).documents).where(eq((await import("@/db/schema")).documents.id, id));
    expect(d.filename).not.toMatch(/[\/<>]/);
  });
});

describe("public status link", () => {
  it("valid token shows minimal data only; the raw token is never stored", async () => {
    const { sales, projectId } = await projectFixture();
    await addDocument(db, { user: sales, projectId, kind: "design", filename: "design.pdf", data: pdf, now });
    const token = await createStatusToken(db, { user: sales, projectId });
    expect(token.length).toBeGreaterThanOrEqual(43); // 256 bits base64url
    const [p] = await db.select().from(projects);
    expect(p.statusTokenHash).not.toContain(token);
    const s = await getPublicStatus(db, token);
    expect(s).toMatchObject({ state: "ok", firstName: "Prashant", stageCode: "advance_received", documentNames: ["design.pdf"] });
    const json = JSON.stringify(s);
    for (const secret of ["Wankhede", "+91", "410012345601", "consumer"]) expect(json).not.toContain(secret);
  });
  it("revoked, unknown and malformed tokens reveal nothing", async () => {
    const { sales, projectId } = await projectFixture();
    const token = await createStatusToken(db, { user: sales, projectId });
    await revokeStatusToken(db, { user: sales, projectId, now });
    expect(await getPublicStatus(db, token)).toEqual({ state: "revoked" });
    expect(await getPublicStatus(db, "a".repeat(43))).toEqual({ state: "unknown" });
    expect(await getPublicStatus(db, "short")).toEqual({ state: "unknown" });
    expect(await getPublicStatus(db, "x' OR '1'='1")).toEqual({ state: "unknown" });
  });
  it("regenerating invalidates the old link and re-enables access with the new one", async () => {
    const { sales, projectId } = await projectFixture();
    const t1 = await createStatusToken(db, { user: sales, projectId });
    const t2 = await createStatusToken(db, { user: sales, projectId });
    expect(t1).not.toBe(t2);
    expect(await getPublicStatus(db, t1)).toEqual({ state: "unknown" });
    expect((await getPublicStatus(db, t2)).state).toBe("ok");
  });
  it("stays viewable after the project is completed", async () => {
    const { sales, projectId } = await projectFixture();
    const token = await createStatusToken(db, { user: sales, projectId });
    await moveStage(db, { user: sales, projectId, toStage: "subsidy_credited", note: null, now, origin: ORIGIN });
    expect(await getPublicStatus(db, token)).toMatchObject({ state: "ok", stageCode: "subsidy_credited" });
    void users;
  });
});
