import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { auditLog, billExtractions, billUploads, leads, messages } from "@/db/schema";
import { getBillState, getLeadFor, getUploadFor } from "@/lib/data/leads";
import { confirmBill, createLead, MAX_UPLOAD_ATTEMPTS, reuploadBill } from "@/lib/leads/service";
import { UploadError } from "@/lib/storage/image";
import { ForbiddenError } from "@/lib/auth/rbac";
import { leadInput, makeUser, sampleBill } from "../helpers/factories";
import { resetDb, testDb as db } from "../helpers/testdb";

const now = new Date("2026-11-06T10:00:00Z");
const allOk = { consumerNo: "ok", tariff: "ok", sanctionedLoadKw: "ok", avgUnitsMonth: "ok" } as const;
beforeEach(resetDb);

describe("lead creation + bill confirmation (happy path = sample LD-30881)", () => {
  it("creates a lead with a re-encoded upload, reads the bill, scores High after confirmation", async () => {
    const owner = await makeUser();
    const { leadId, duplicate } = await createLead(db, { user: owner, input: leadInput(), original: sampleBill(), now });
    expect(duplicate).toBe(false);
    const lead = (await getLeadFor(db, owner, leadId))!;
    expect(lead).toMatchObject({ status: "bill_review", humanId: "LD-30001", consentTextVersion: "v1" });
    expect(lead.scoreBand).toBeNull(); // nothing is scored before a person confirms

    const state = await getBillState(db, leadId);
    expect(state.latest?.mime).toBe("image/jpeg");
    expect(state.extraction?.status).toBe("pending");

    const res = await confirmBill(db, { user: owner, leadId, decisions: allOk, typed: {}, now });
    expect(res).toEqual({ ok: true, band: "high" });
    const after = (await getLeadFor(db, owner, leadId))!;
    expect(after).toMatchObject({ status: "scored", scoreBand: "high", nextStep: "survey", recommendedKw: "3.0", unitsPerMonth: 340 });
    const [msg] = await db.select().from(messages);
    expect(msg).toMatchObject({ toPhone: owner.phone, status: "mock_sent", template: "lead_received" });
    expect(msg.body).toContain("LD-30001");
  });

  it("keeps extracted vs confirmed values and flags edits (accuracy can be measured later)", async () => {
    const owner = await makeUser();
    const { leadId } = await createLead(db, { user: owner, input: leadInput(), original: sampleBill(), now });
    await confirmBill(db, { user: owner, leadId, decisions: { ...allOk, avgUnitsMonth: "fix" }, typed: { avgUnitsMonth: "300" }, now });
    const [ex] = await db.select().from(billExtractions);
    expect(ex.status).toBe("edited");
    expect((ex.rawJson as { avgUnitsMonth: { value: number } }).avgUnitsMonth.value).toBe(340);
    expect((ex.confirmedJson as { avgUnitsMonth: number }).avgUnitsMonth).toBe(300);
  });

  it("ambiguous bill accepted as-is is capped at Medium with a human check", async () => {
    const owner = await makeUser();
    const { leadId } = await createLead(db, { user: owner, input: leadInput(), original: sampleBill("bill-ambiguous.png"), now });
    const res = await confirmBill(db, {
      user: owner, leadId, now,
      decisions: { tariff: "ok", avgUnitsMonth: "ok" }, // accepts the reader's unsure 400 units (confidence 0.6)
      typed: { consumerNo: "410012345604", sanctionedLoadKw: "" } as never,
    });
    expect(res.ok).toBe(false); // missing sanctioned load must be typed
    const ok = await confirmBill(db, {
      user: owner, leadId, now, decisions: { tariff: "ok", avgUnitsMonth: "ok" },
      typed: { consumerNo: "410012345604", sanctionedLoadKw: "5" },
    });
    expect(ok).toEqual({ ok: true, band: "medium" });
    expect((await getLeadFor(db, owner, leadId))!.needsHumanCheck).toBe(true);
  });

  it("a tenant is Low (call), a small bill is Low, and neither is rejected", async () => {
    const t = await makeUser();
    const a = await createLead(db, { user: t, input: leadInput({ ownerType: "tenant", monthlyBillPaise: 190_000, pincode: "440022" }), original: sampleBill("bill-good-210.png"), now });
    expect(await confirmBill(db, { user: t, leadId: a.leadId, decisions: allOk, typed: {}, now })).toEqual({ ok: true, band: "low" });
    const o = await makeUser();
    const b = await createLead(db, { user: o, input: leadInput({ monthlyBillPaise: 65_000 }), original: sampleBill("bill-good-85.png"), now });
    await confirmBill(db, { user: o, leadId: b.leadId, decisions: allOk, typed: {}, now });
    const lead = (await getLeadFor(db, o, b.leadId))!;
    expect(lead).toMatchObject({ scoreBand: "low", nextStep: "call", recommendedKw: "1.0" });
  });
});

describe("poor / unknown photos never dead-end", () => {
  it("blurry photo: flagged poor, then re-upload works, up to 3 tries", async () => {
    const owner = await makeUser();
    const { leadId } = await createLead(db, { user: owner, input: leadInput(), original: sampleBill("bill-blurry.png"), now });
    expect((await getBillState(db, leadId)).extraction?.status).toBe("rejected_photo");
    expect(await reuploadBill(db, { user: owner, leadId, original: sampleBill("bill-blurry.png"), now })).toEqual({ ok: true });
    expect(await reuploadBill(db, { user: owner, leadId, original: sampleBill(), now })).toEqual({ ok: true });
    const s = await getBillState(db, leadId);
    expect(s.attempts).toBe(MAX_UPLOAD_ATTEMPTS);
    expect(s.extraction?.status).toBe("pending"); // latest wins
    expect(await reuploadBill(db, { user: owner, leadId, original: sampleBill(), now })).toEqual({ ok: false, reason: "max_attempts" });
    expect(await db.select().from(billUploads)).toHaveLength(3); // first upload retained
  });
  it("unknown image -> manual entry confirms with typed values, capped at Medium at most", async () => {
    const owner = await makeUser();
    const { leadId } = await createLead(db, { user: owner, input: leadInput(), original: sampleBill("bill-good-340.png").subarray(0), now });
    // replace with a valid-but-unknown image
    const sharp = (await import("sharp")).default;
    const unknown = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#abc" } }).png().toBuffer();
    const o2 = await makeUser();
    const r = await createLead(db, { user: o2, input: leadInput({ pincode: "440099" }), original: unknown, now });
    expect((await getBillState(db, r.leadId)).extraction?.status).toBe("pending");
    const res = await confirmBill(db, { user: o2, leadId: r.leadId, decisions: {}, now, typed: { consumerNo: "410012345699", tariff: "LT-I", sanctionedLoadKw: "5", avgUnitsMonth: "340" } });
    expect(res).toEqual({ ok: true, band: "medium" });
    expect(leadId).toBeTruthy();
  });
  it("rejects a forged image before creating anything", async () => {
    const owner = await makeUser();
    await expect(createLead(db, { user: owner, input: leadInput(), original: Buffer.from("<html>not an image</html>"), now })).rejects.toBeInstanceOf(UploadError);
    expect(await db.select().from(leads)).toHaveLength(0);
  });
  it("returns field errors for bad typed values instead of saving", async () => {
    const owner = await makeUser();
    const { leadId } = await createLead(db, { user: owner, input: leadInput(), original: sampleBill("bill-ambiguous.png"), now });
    const res = await confirmBill(db, { user: owner, leadId, decisions: {}, typed: { consumerNo: "12", tariff: "LT", sanctionedLoadKw: "5", avgUnitsMonth: "340" }, now });
    expect(res).toMatchObject({ ok: false, errors: { consumerNo: "bill.err.consumer" } });
    expect((await getLeadFor(db, owner, leadId))!.status).toBe("bill_review");
  });
});

describe("duplicates and double submit", () => {
  it("same idempotency key returns the same lead (double-submit protection)", async () => {
    const owner = await makeUser();
    const input = leadInput();
    const a = await createLead(db, { user: owner, input, original: sampleBill(), now });
    const b = await createLead(db, { user: owner, input, original: sampleBill(), now });
    expect(b.leadId).toBe(a.leadId);
    expect(await db.select().from(leads)).toHaveLength(1);
  });
  it("same phone + pincode within 7 days links to the existing lead; after 7 days creates a new one", async () => {
    const owner = await makeUser();
    const a = await createLead(db, { user: owner, input: leadInput(), original: sampleBill(), now });
    const dup = await createLead(db, { user: owner, input: leadInput(), original: sampleBill(), now: new Date(now.getTime() + 3 * 86_400_000) });
    expect(dup).toEqual({ leadId: a.leadId, duplicate: true });
    const later = await createLead(db, { user: owner, input: leadInput(), original: sampleBill(), now: new Date(now.getTime() + 8 * 86_400_000) });
    expect(later.duplicate).toBe(false);
    expect(later.leadId).not.toBe(a.leadId);
  });
});

describe("IDOR: access control by ID tampering", () => {
  it("homeowner B cannot read, confirm, re-upload or fetch the bill image of homeowner A", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const { leadId } = await createLead(db, { user: a, input: leadInput(), original: sampleBill(), now });
    const upload = (await getBillState(db, leadId)).latest!;

    expect(await getLeadFor(db, b, leadId)).toBeNull();
    expect(await getUploadFor(db, b, upload.id)).toBeNull();
    await expect(confirmBill(db, { user: b, leadId, decisions: allOk, typed: {}, now })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await reuploadBill(db, { user: b, leadId, original: sampleBill(), now })).toEqual({ ok: false, reason: "not_found" });
  });
  it("owner and sales can read; anonymous cannot; malformed ids are safe", async () => {
    const a = await makeUser();
    const s = await makeUser("sales");
    const { leadId } = await createLead(db, { user: a, input: leadInput(), original: sampleBill(), now });
    expect(await getLeadFor(db, a, leadId)).not.toBeNull();
    expect(await getLeadFor(db, s, leadId)).not.toBeNull();
    expect(await getLeadFor(db, null, leadId)).toBeNull();
    expect(await getLeadFor(db, s, "1; drop table leads")).toBeNull();
    expect(await getUploadFor(db, s, "not-a-uuid")).toBeNull();
  });
  it("sales editing a confirmed bill is audit-logged with field names only", async () => {
    const a = await makeUser();
    const s = await makeUser("sales");
    const { leadId } = await createLead(db, { user: a, input: leadInput(), original: sampleBill(), now });
    await confirmBill(db, { user: a, leadId, decisions: allOk, typed: {}, now });
    await confirmBill(db, { user: s, leadId, decisions: {}, typed: { consumerNo: "410012345601", tariff: "LT-I Residential", sanctionedLoadKw: "5", avgUnitsMonth: "360" }, now });
    const logs = await db.select().from(auditLog).where(eq(auditLog.action, "bill.edited"));
    expect(logs).toHaveLength(1);
    expect(logs[0].meta).toMatchObject({ byRole: "sales", changedFields: ["avgUnitsMonth"] });
    expect(JSON.stringify(logs[0].meta)).not.toContain("410012345601");
    expect((await db.select().from(messages)).length).toBe(1); // no second "received" message on edit
  });
});
