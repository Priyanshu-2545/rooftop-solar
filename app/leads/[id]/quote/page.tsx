import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { quotes, users } from "@/db/schema";
import { QuoteBuilder } from "@/components/quote/QuoteBuilder";
import { requireSalesUser } from "@/lib/auth/current";
import { getLeadFor } from "@/lib/data/leads";
import { messagesFor } from "@/lib/i18n/make-t";
import { suggestSizes } from "@/lib/quote/compute";
import { loadRuleContext, QUOTE_VALID_DAYS, type Selection } from "@/lib/quote/service";
import { formatDateIST } from "@/lib/sales/format";

export const metadata = { title: "Quote builder" };

export default async function QuoteBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSalesUser();
  const db = getDb();
  const lead = await getLeadFor(db, user, id);
  if (!lead) notFound();
  if (!lead.recommendedKw || lead.status === "bill_review") redirect(`/leads/${lead.id}`);

  const now = new Date();
  const ctx = await loadRuleContext(db, now);
  const rec = Math.round(Number(lead.recommendedKw));
  const { sizes, roofLimited } = suggestSizes(rec, lead.roofAreaSqft);
  const [draft] = await db.select().from(quotes).where(eq(quotes.leadId, lead.id)).orderBy(desc(quotes.version)).limit(1);
  const fromDraft = draft?.status === "draft" ? ((draft.inputsSnapshot as { selections?: Selection[] }).selections ?? null) : null;
  const initial: Selection[] = fromDraft ?? sizes.map((kw) => ({ kw, tier: "standard" as const }));
  const [owner] = await db.select({ lang: users.language }).from(users).where(eq(users.id, lead.ownerUserId)).limit(1);
  const iso = <T extends { effectiveFrom: Date; effectiveTo: Date | null }>(r: T) => ({ ...r, effectiveFrom: r.effectiveFrom.toISOString(), effectiveTo: r.effectiveTo?.toISOString() ?? null });
  const subsidyRow = ctx.subsidyRules.find((r) => r.customerType === lead.customerType);

  return (
    <section>
      <h1 className="display mb-2 text-4xl">Quote for {lead.humanId}</h1>
      <QuoteBuilder
        leadId={lead.id} recommendedKw={rec} customerType={lead.customerType} initial={initial} settings={ctx.settings}
        priceRules={ctx.priceRules.map(iso)} subsidyRules={ctx.subsidyRules.map(iso)}
        roofNote={roofLimited ? `The roof area (${lead.roofAreaSqft} sq ft) fits less than the recommended ${rec} kW, so smaller options are suggested.` : null}
        ruleNote={subsidyRow ? `Subsidy rule: ${("scheme" in subsidyRow ? String((subsidyRow as unknown as { scheme: string }).scheme) : "scheme")}, effective from ${formatDateIST(subsidyRow.effectiveFrom)} (unverified, assumption A1).` : "No subsidy rule applies to this customer type."}
        messages={messagesFor(owner?.lang ?? "en", ["quote.", "common."])}
        validUntilText={formatDateIST(new Date(now.getTime() + QUOTE_VALID_DAYS * 86_400_000))}
      />
    </section>
  );
}
