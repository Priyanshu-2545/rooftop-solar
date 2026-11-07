import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { quotes, surveys } from "@/db/schema";
import { BillReviewForm, type ReviewField } from "@/components/lead/BillReviewForm";
import { LinkButton } from "@/components/ui/Button";
import { Chip, ScoreChip } from "@/components/ui/Chip";
import type { SessionUser } from "@/lib/auth/session";
import { BILL_FIELDS } from "@/lib/ai/schema";
import { getBillState, type LeadRow } from "@/lib/data/leads";
import { messagesFor } from "@/lib/i18n/make-t";
import { formatINR } from "@/lib/rules/money";
import { formatDateIST, maskConsumerNo } from "@/lib/sales/format";
import { RevealConsumer, ScheduleForm, SurveyForm } from "./Forms";

const REASON: Record<string, string> = {
  tenant: "Tenant: needs the owner's say", small_bill: "Small bill", strong_bill: "Strong bill and roof fit",
  roof_too_small: "Roof smaller than the size needs", mid_bill: "Middle-range bill", needs_human_check: "Needs a human check",
};

export async function SalesLeadDetail({ lead }: { lead: LeadRow; user: SessionUser }) {
  const db = getDb();
  const [bill, [survey], qs] = await Promise.all([
    getBillState(db, lead.id),
    db.select().from(surveys).where(eq(surveys.leadId, lead.id)).limit(1),
    db.select().from(quotes).where(eq(quotes.leadId, lead.id)).orderBy(desc(quotes.createdAt)),
  ]);
  const ex = bill.extraction;
  const confirmed = ex?.confirmedJson as Record<string, unknown> | null;
  const fields: ReviewField[] = BILL_FIELDS.map((k) => ({ key: k, value: confirmed?.[k] !== undefined ? String(confirmed[k]) : null, confidence: null }));
  const reasons = (lead.scoreReasons ?? []) as string[];
  const dl = "grid grid-cols-[130px_1fr] gap-y-2";

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="display num text-4xl">{lead.humanId}</h1>
        <ScoreChip band={lead.scoreBand} /><Chip>{lead.status.replace("_", " ")}</Chip>
        {lead.customerType === "commercial" ? <Chip kind="warn">Small business: no home subsidy</Chip> : null}
        {lead.needsHumanCheck ? <Chip kind="warn">Needs human check</Chip> : null}
      </div>
      <p className="mb-8 text-muted">{reasons.map((r) => REASON[r] ?? r).join(" · ") || "Not scored yet"}
        {lead.nextStep ? <> · <strong className="text-ink">Next: {lead.nextStep === "survey" ? "survey visit" : "short call"}</strong></> : null}</p>

      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="display mb-3 text-2xl">Bill</h2>
          {bill.latest ? (
            // eslint-disable-next-line @next/next/no-img-element -- authorised same-origin route
            <img src={`/api/bills/${bill.latest.id}`} alt="Electricity bill photo" loading="lazy" className="mb-4 w-full max-w-sm rounded-md border border-hairline" />
          ) : <p className="mb-4 text-muted">No bill photo uploaded.</p>}
          <dl className={dl}>
            <dt className="text-muted">Consumer no.</dt>
            <dd>{ex?.consumerNo ? <RevealConsumer leadId={lead.id} masked={maskConsumerNo(ex.consumerNo)} /> : "—"}</dd>
            <dt className="text-muted">Tariff</dt><dd>{ex?.tariff ?? "—"}</dd>
            <dt className="text-muted">Sanctioned load</dt><dd className="num">{ex?.sanctionedLoadKw ? `${Number(ex.sanctionedLoadKw)} kW` : "—"}</dd>
            <dt className="text-muted">Units / month</dt><dd className="num">{ex?.avgUnitsMonth ?? "—"}</dd>
            <dt className="text-muted">Reading</dt><dd>{ex ? `${ex.status} (${ex.backend} reader)` : "none"}</dd>
          </dl>
          {ex && lead.status !== "bill_review" ? (
            <details className="mt-4 border-t border-hairline pt-2">
              <summary className="flex min-h-12 items-center font-semibold underline underline-offset-4">Edit bill values (audit-logged)</summary>
              <div className="pb-24 pt-2"><BillReviewForm leadId={lead.id} imageSrc={null} fields={fields} mode="edit" messages={messagesFor("en", ["bill.", "lead.", "roof.", "common."])} submitLabelKey="common.save" /></div>
            </details>
          ) : null}
        </div>

        <div>
          <h2 className="display mb-3 text-2xl">Lead</h2>
          <dl className={`${dl} mb-8`}>
            <dt className="text-muted">Owner / tenant</dt><dd>{lead.ownerType}</dd>
            <dt className="text-muted">Roof</dt><dd className="num">{lead.roofType.replace("_", " ")} · {lead.roofAreaSqft} sq ft</dd>
            <dt className="text-muted">Monthly bill</dt><dd className="num">{formatINR(lead.monthlyBillPaise)}</dd>
            <dt className="text-muted">Pincode</dt><dd className="num">{lead.pincode}</dd>
            <dt className="text-muted">Recommended</dt><dd className="num">{lead.recommendedKw ? `${Number(lead.recommendedKw)} kW` : "none yet"}</dd>
            <dt className="text-muted">Consent</dt><dd className="num">{lead.consentTextVersion}, {formatDateIST(lead.consentAt)}</dd>
          </dl>

          <div className="mb-8 flex flex-wrap gap-3">
            {lead.recommendedKw && lead.status !== "bill_review" ? <LinkButton href={`/leads/${lead.id}/quote`}>Start quote</LinkButton> : null}
          </div>

          <h2 className="display mb-3 text-2xl">Schedule</h2>
          <div className="mb-8"><ScheduleForm leadId={lead.id} /></div>
          <h2 className="display mb-3 text-2xl">Survey</h2>
          <div className="mb-8"><SurveyForm leadId={lead.id} initial={survey ? { roofOk: survey.roofOk, usable: survey.usableAreaSqft, shading: survey.shading, notes: survey.notes } : undefined} /></div>

          <h2 className="display mb-3 text-2xl">Quotes</h2>
          {qs.length === 0 ? <p className="text-muted">No quotes yet.</p> : (
            <ul className="divide-y divide-hairline border-y border-hairline">
              {qs.map((q) => <li key={q.id}><Link href={`/quotes/${q.id}`} className="flex min-h-12 items-center justify-between py-2"><span className="num">v{q.version}</span><Chip>{q.status}</Chip></Link></li>)}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
