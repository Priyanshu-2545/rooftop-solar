import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { messages, payments, priceRules, projects, quotes } from "@/db/schema";
import { confirmBill, createLead } from "@/lib/leads/service";
import { acceptQuote, getQuoteFor, saveQuote, type Selection } from "@/lib/quote/service";
import { ForbiddenError } from "@/lib/auth/rbac";
import { leadInput, makeUser, sampleBill, seedReference } from "../helpers/factories";
import { resetDb, testDb as db } from "../helpers/testdb";

const now = new Date("2026-11-07T10:00:00Z");
const ORIGIN = "http://localhost:3000";
const sel: Selection[] = [{ kw: 2, tier: "standard" }, { kw: 3, tier: "standard" }, { kw: 4, tier: "standard" }];
const allOk = { consumerNo: "ok", tariff: "ok", sanctionedLoadKw: "ok", avgUnitsMonth: "ok" } as const;

async function scoredLead() {
  const owner = await makeUser();
  const sales = await makeUser("sales");
  const { leadId } = await createLead(db, { user: owner, input: leadInput(), original: sampleBill(), now });
  await confirmBill(db, { user: owner, leadId, decisions: allOk, typed: {}, now });
  return { owner, sales, leadId };
}
beforeEach(async () => { await resetDb(); await seedReference(); });

describe("saveQuote", () => {
  it("computes the sample 3 kW option from the dated tables and records the rules used", async () => {
    const { sales, leadId } = await scoredLead();
    const r = await saveQuote(db, { user: sales, leadId, selections: sel, send: false, now, origin: ORIGIN });
    expect(r).toMatchObject({ ok: true, sent: false });
    const q = (await getQuoteFor(db, sales, (r as { quoteId: string }).quoteId, now))!;
    const out = q.outputsSnapshot as { options: { kw: number; grossPaise: number; subsidyPaise: number; netPaise: number; paybackYears: number }[]; recommendedIndex: number };
    expect(out.options[1]).toMatchObject({ kw: 3, grossPaise: 16_500_000, subsidyPaise: 7_800_000, netPaise: 8_700_000, paybackYears: 2.6 });
    expect(out.recommendedIndex).toBe(1);
    expect(q.ruleIdsUsed.length).toBeGreaterThanOrEqual(2);
    expect(q.status).toBe("draft");
  });
  it("send: marks sent with a 15-day validity and queues a mock message to the lead owner only", async () => {
    const { owner, sales, leadId } = await scoredLead();
    const r = await saveQuote(db, { user: sales, leadId, selections: sel, send: true, now, origin: ORIGIN });
    expect(r).toMatchObject({ ok: true, sent: true });
    const [q] = await db.select().from(quotes);
    expect(q.status).toBe("sent");
    expect(q.validUntil!.getTime() - now.getTime()).toBe(15 * 86_400_000);
    const msgs = await db.select().from(messages).where(eq(messages.template, "quote_sent"));
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ toPhone: owner.phone, status: "mock_sent" });
    expect(msgs[0].body).toContain(`/quotes/${q.id}`);
  });
  it("SNAPSHOT: changing a price rule after sending does not change the sent quote", async () => {
    const { sales, leadId } = await scoredLead();
    const r = (await saveQuote(db, { user: sales, leadId, selections: sel, send: true, now, origin: ORIGIN })) as { quoteId: string };
    const before = (await getQuoteFor(db, sales, r.quoteId, now))!.outputsSnapshot;
    await db.update(priceRules).set({ pricePaise: 99_900_000 }).where(eq(priceRules.kw, 3));
    const after = (await getQuoteFor(db, sales, r.quoteId, now))!.outputsSnapshot;
    expect(after).toEqual(before);
    // a NEW quote version does pick up the new price, and the sent one stays untouched
    const r2 = (await saveQuote(db, { user: sales, leadId, selections: sel, send: false, now, origin: ORIGIN })) as { quoteId: string };
    expect(r2.quoteId).not.toBe(r.quoteId);
    const q2 = (await getQuoteFor(db, sales, r2.quoteId, now))!;
    expect((q2.outputsSnapshot as { options: { grossPaise: number }[] }).options[1].grossPaise).toBe(99_900_000);
    expect(q2.version).toBe(2);
  });
  it("re-prices with a warning (and does not send) when rules changed since the preview", async () => {
    const { sales, leadId } = await scoredLead();
    const r = await saveQuote(db, { user: sales, leadId, selections: sel, send: true, now, origin: ORIGIN, shownRuleIds: ["old-rule-id"] });
    expect(r).toMatchObject({ ok: false, reason: "repriced" });
    expect((await db.select().from(quotes))[0].status).toBe("draft");
    expect(await db.select().from(messages).where(eq(messages.template, "quote_sent"))).toHaveLength(0);
  });
  it("rejects a size with no price, empty and >3 options, and a homeowner caller", async () => {
    const { owner, sales, leadId } = await scoredLead();
    expect(await saveQuote(db, { user: sales, leadId, selections: [{ kw: 2.5, tier: "standard" }], send: false, now, origin: ORIGIN })).toMatchObject({ reason: "no_price" });
    expect(await saveQuote(db, { user: sales, leadId, selections: [], send: false, now, origin: ORIGIN })).toMatchObject({ reason: "invalid" });
    expect(await saveQuote(db, { user: sales, leadId, selections: [...sel, sel[0]], send: false, now, origin: ORIGIN })).toMatchObject({ reason: "invalid" });
    await expect(saveQuote(db, { user: owner, leadId, selections: sel, send: false, now, origin: ORIGIN })).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("commercial lead: no subsidy, with a warning flag in the outputs", async () => {
    const { sales, leadId } = await scoredLead();
    await db.update((await import("@/db/schema")).leads).set({ customerType: "commercial" });
    const r = (await saveQuote(db, { user: sales, leadId, selections: [{ kw: 3, tier: "standard" }], send: false, now, origin: ORIGIN })) as { quoteId: string };
    const o = ((await getQuoteFor(db, sales, r.quoteId, now))!.outputsSnapshot as { options: { subsidyPaise: number; subsidyWarning: string }[] }).options[0];
    expect(o).toMatchObject({ subsidyPaise: 0, subsidyWarning: "no_rule_for_customer_type" });
  });
});

describe("quote access (IDOR) and acceptance", () => {
  it("homeowner sees own quote only after it is sent; another homeowner never does", async () => {
    const { owner, sales, leadId } = await scoredLead();
    const other = await makeUser();
    const d = (await saveQuote(db, { user: sales, leadId, selections: sel, send: false, now, origin: ORIGIN })) as { quoteId: string };
    expect(await getQuoteFor(db, owner, d.quoteId, now)).toBeNull(); // draft hidden
    await saveQuote(db, { user: sales, leadId, selections: sel, send: true, now, origin: ORIGIN });
    expect(await getQuoteFor(db, owner, d.quoteId, now)).not.toBeNull();
    expect(await getQuoteFor(db, other, d.quoteId, now)).toBeNull(); // IDOR
    expect(await getQuoteFor(db, null, d.quoteId, now)).toBeNull();
    expect(await getQuoteFor(db, owner, "x'; drop table quotes;--", now)).toBeNull();
  });
  it("accept: mock 10% advance, project at 'advance received', idempotent on double tap", async () => {
    const { owner, sales, leadId } = await scoredLead();
    const { quoteId } = (await saveQuote(db, { user: sales, leadId, selections: sel, send: true, now, origin: ORIGIN })) as { quoteId: string };
    const a = await acceptQuote(db, { user: owner, quoteId, optionIndex: 1, idempotencyKey: "k1-abcdefgh", now, origin: ORIGIN });
    expect(a).toMatchObject({ ok: true, advancePaise: 870_000 }); // 10% of ₹87,000
    const again = await acceptQuote(db, { user: owner, quoteId, optionIndex: 1, idempotencyKey: "k2-abcdefgh", now, origin: ORIGIN });
    expect(again).toEqual(a);
    expect(await db.select().from(projects)).toHaveLength(1);
    expect(await db.select().from(payments)).toHaveLength(1);
    expect((await db.select().from(projects))[0].stageCode).toBe("advance_received");
    expect((await db.select().from(quotes))[0]).toMatchObject({ status: "accepted", selectedOption: 1 });
  });
  it("accept is refused for another homeowner, a draft, an expired quote and a bad option", async () => {
    const { owner, sales, leadId } = await scoredLead();
    const other = await makeUser();
    const draft = (await saveQuote(db, { user: sales, leadId, selections: sel, send: false, now, origin: ORIGIN })) as { quoteId: string };
    const args = { quoteId: draft.quoteId, optionIndex: 0, idempotencyKey: "k-abcdefgh", now, origin: ORIGIN };
    expect(await acceptQuote(db, { ...args, user: owner })).toMatchObject({ ok: false, reason: "not_found" }); // draft invisible
    await saveQuote(db, { user: sales, leadId, selections: sel, send: true, now, origin: ORIGIN });
    expect(await acceptQuote(db, { ...args, user: other })).toMatchObject({ ok: false, reason: "not_found" });
    expect(await acceptQuote(db, { ...args, user: owner, optionIndex: 9 })).toMatchObject({ ok: false, reason: "bad_option" });
    const late = new Date(now.getTime() + 16 * 86_400_000);
    expect(await acceptQuote(db, { ...args, user: owner, now: late })).toMatchObject({ ok: false, reason: "expired" });
    expect(await db.select().from(projects)).toHaveLength(0);
  });
});
