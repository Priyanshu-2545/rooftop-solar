// Quote business logic (db-injected, no next/* imports => integration-testable).
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { appSettings, auditLog, leads, payments, priceRules, projectEvents, projects, quotes, subsidyRules, users } from "@/db/schema";
import { ForbiddenError, canViewQuote } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";
import { getLeadFor, isUuid } from "@/lib/data/leads";
import { sendToLeadOwner } from "@/lib/messaging/provider";
import { percentOfPaise } from "@/lib/rules/money";
import { resolveSettings, type QuoteSettings } from "@/lib/rules/settings";
import type { SubsidyRule } from "@/lib/rules/subsidy";
import { computeOption, NoPriceError, type OptionOutput, type PriceRule } from "./compute";

export const QUOTE_VALID_DAYS = 15; // A21
export const ADVANCE_BP = 1000; // A22: advance = 10% of net cost (mock payment)
import { ruleIdsOf, type Selection } from "./service-shared";
export { ruleIdsOf, type Selection };

export interface RuleContext {
  priceRules: PriceRule[];
  subsidyRules: SubsidyRule[];
  settings: QuoteSettings;
}

export async function loadRuleContext(db: Db, on: Date): Promise<RuleContext> {
  const [p, s, a] = await Promise.all([db.select().from(priceRules), db.select().from(subsidyRules), db.select().from(appSettings)]);
  return { priceRules: p, subsidyRules: s, settings: resolveSettings(a, on) };
}

export function buildOptions(ctx: RuleContext, p: { customerType: "residential" | "commercial"; selections: Selection[]; on: Date }): OptionOutput[] {
  return p.selections.map((s) => computeOption({ ...s, customerType: p.customerType, on: p.on, ...ctx }));
}

export type SaveResult =
  | { ok: true; quoteId: string; sent: boolean }
  | { ok: false; reason: "invalid" | "no_price" | "not_ready" | "repriced"; quoteId?: string };

export async function saveQuote(
  db: Db,
  p: { user: SessionUser; leadId: string; selections: Selection[]; send: boolean; now: Date; origin: string; shownRuleIds?: string[] },
): Promise<SaveResult> {
  if (p.user.role !== "sales") throw new ForbiddenError();
  const lead = await getLeadFor(db, p.user, p.leadId);
  if (!lead) throw new ForbiddenError();
  const { selections } = p;
  if (selections.length < 1 || selections.length > 3 || selections.some((s) => !Number.isFinite(s.kw) || s.kw <= 0 || (s.tier !== "standard" && s.tier !== "premium")))
    return { ok: false, reason: "invalid" };
  if (!lead.recommendedKw || lead.status === "bill_review") return { ok: false, reason: "not_ready" };

  const ctx = await loadRuleContext(db, p.now);
  let options: OptionOutput[];
  try {
    options = buildOptions(ctx, { customerType: lead.customerType, selections, on: p.now });
  } catch (e) {
    if (e instanceof NoPriceError) return { ok: false, reason: "no_price" };
    if (e instanceof RangeError) return { ok: false, reason: "invalid" };
    throw e;
  }
  const rec = Number(lead.recommendedKw);
  const recommendedIndex = Math.max(0, selections.findIndex((s) => s.kw === Math.round(rec)));
  const [owner] = await db.select({ lang: users.language }).from(users).where(eq(users.id, lead.ownerUserId)).limit(1);
  const ruleIds = ruleIdsOf(options);
  const values = {
    inputsSnapshot: { leadHumanId: lead.humanId, customerType: lead.customerType, recommendedKw: rec, on: p.now.toISOString(), settings: ctx.settings, selections, language: owner?.lang ?? "en" },
    outputsSnapshot: { options, recommendedIndex },
    ruleIdsUsed: ruleIds,
  };

  // Reuse the latest DRAFT; a sent quote is never modified (a new version is created instead).
  const [latest] = await db.select().from(quotes).where(eq(quotes.leadId, lead.id)).orderBy(desc(quotes.version)).limit(1);
  let quoteId: string;
  if (latest?.status === "draft") {
    await db.update(quotes).set(values).where(eq(quotes.id, latest.id));
    quoteId = latest.id;
  } else {
    const [q] = await db.insert(quotes).values({ leadId: lead.id, version: (latest?.version ?? 0) + 1, status: "draft", createdBy: p.user.id, createdAt: p.now, ...values }).returning({ id: quotes.id });
    quoteId = q.id;
  }
  if (!p.send) return { ok: true, quoteId, sent: false };

  // Rules changed between the preview and "send": re-priced and saved as a draft, but NOT sent. Review first.
  if (p.shownRuleIds && p.shownRuleIds.slice().sort().join() !== ruleIds.join()) return { ok: false, reason: "repriced", quoteId };

  await db.update(quotes).set({ status: "sent", sentAt: p.now, validUntil: new Date(p.now.getTime() + QUOTE_VALID_DAYS * 86_400_000) }).where(eq(quotes.id, quoteId));
  await db.update(leads).set({ status: "quoted" }).where(eq(leads.id, lead.id));
  await sendToLeadOwner(db, { leadId: lead.id, template: "quote_sent", key: "msg.quoteSent", vars: { link: `${p.origin}/quotes/${quoteId}` } });
  await db.insert(auditLog).values({ actorUserId: p.user.id, action: "quote.sent", entity: "quote", entityId: quoteId, meta: { ruleIds } });
  return { ok: true, quoteId, sent: true };
}

export type QuoteView = typeof quotes.$inferSelect & { lead: typeof leads.$inferSelect };

/** Ownership + visibility rules in one place (homeowners only see sent/accepted quotes of their own lead). */
export async function getQuoteFor(db: Db, user: SessionUser | null, id: string, now: Date = new Date()): Promise<QuoteView | null> {
  if (!user || !isUuid(id)) return null;
  const [row] = await db.select({ q: quotes, lead: leads }).from(quotes).innerJoin(leads, eq(leads.id, quotes.leadId)).where(eq(quotes.id, id)).limit(1);
  if (!row || !canViewQuote(user, row.lead, row.q)) return null;
  let q = row.q;
  if (q.status === "sent" && q.validUntil && q.validUntil.getTime() <= now.getTime()) {
    await db.update(quotes).set({ status: "expired" }).where(eq(quotes.id, q.id));
    q = { ...q, status: "expired" };
  }
  return { ...q, lead: row.lead };
}

export type AcceptResult = { ok: true; projectId: string; advancePaise: number } | { ok: false; reason: "not_found" | "expired" | "not_sent" | "bad_option" };

export async function acceptQuote(db: Db, p: { user: SessionUser; quoteId: string; optionIndex: number; idempotencyKey: string; now: Date; origin: string }): Promise<AcceptResult> {
  const quote = await getQuoteFor(db, p.user, p.quoteId, p.now);
  if (!quote || p.user.role !== "homeowner" || quote.lead.ownerUserId !== p.user.id) return { ok: false, reason: "not_found" };
  const options = (quote.outputsSnapshot as { options: OptionOutput[] }).options;

  if (quote.status === "accepted") { // idempotent: a double tap returns the same project
    const [pr] = await db.select().from(projects).where(eq(projects.quoteId, quote.id)).limit(1);
    const [pay] = await db.select().from(payments).where(eq(payments.quoteId, quote.id)).limit(1);
    return pr ? { ok: true, projectId: pr.id, advancePaise: pay?.amountPaise ?? 0 } : { ok: false, reason: "not_found" };
  }
  if (quote.status === "expired") return { ok: false, reason: "expired" };
  if (quote.status !== "sent") return { ok: false, reason: "not_sent" };
  if (!Number.isInteger(p.optionIndex) || p.optionIndex < 0 || p.optionIndex >= options.length) return { ok: false, reason: "bad_option" };

  const advancePaise = percentOfPaise(options[p.optionIndex].netPaise, ADVANCE_BP);
  const result = await db.transaction(async (tx) => {
    const t = tx as unknown as Db;
    // the status flip is the lock: only one concurrent accept wins
    const won = await t.update(quotes).set({ status: "accepted", selectedOption: p.optionIndex }).where(and(eq(quotes.id, quote.id), eq(quotes.status, "sent"))).returning({ id: quotes.id });
    if (won.length === 0) return null;
    await t.insert(payments).values({ quoteId: quote.id, amountPaise: advancePaise, ref: `MOCK-${quote.lead.humanId}`, idempotencyKey: p.idempotencyKey, createdAt: p.now });
    const [pr] = await t.insert(projects).values({ humanId: `PJ-${quote.lead.humanId.slice(3)}`, quoteId: quote.id, stageCode: "advance_received", startedAt: p.now, stageEnteredAt: p.now }).returning({ id: projects.id });
    await t.insert(projectEvents).values({ projectId: pr.id, stageCode: "advance_received", note: "Advance received (mock payment)", actorUserId: p.user.id, at: p.now });
    await t.update(leads).set({ status: "won" }).where(eq(leads.id, quote.lead.id));
    await t.insert(auditLog).values({ actorUserId: p.user.id, action: "quote.accepted", entity: "quote", entityId: quote.id });
    return pr.id;
  });
  if (!result) return acceptQuote(db, p); // lost a race: re-read, returns the winner's project
  await sendToLeadOwner(db, { leadId: quote.lead.id, template: "advance", key: "msg.advance", vars: { amount: `₹${advancePaise / 100}`, link: `${p.origin}/projects/${result}` } });
  return { ok: true, projectId: result, advancePaise };
}
