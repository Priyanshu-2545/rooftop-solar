import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { projects, subsidyRules } from "@/db/schema";
import { AcceptForm } from "@/components/quote/AcceptForm";
import { QuoteStory } from "@/components/quote/QuoteStory";
import { Chip } from "@/components/ui/Chip";
import { LinkButton } from "@/components/ui/Button";
import { getUser } from "@/lib/auth/current";
import { getT, messagesFor } from "@/lib/i18n";
import { makeT, isLocale } from "@/lib/i18n/make-t";
import type { OptionOutput } from "@/lib/quote/compute";
import { ADVANCE_BP, getQuoteFor } from "@/lib/quote/service";
import { formatINR, percentOfPaise } from "@/lib/rules/money";
import type { QuoteSettings } from "@/lib/rules/settings";
import { formatDateIST } from "@/lib/sales/format";

export const metadata = { title: "Your solar quote" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/signin");
  const db = getDb();
  const q = await getQuoteFor(db, user, id);
  if (!q) notFound();

  const sales = user.role === "sales";
  const snap = q.inputsSnapshot as { language?: string; settings: QuoteSettings };
  const out = q.outputsSnapshot as { options: OptionOutput[]; recommendedIndex: number };
  // Sales preview in the OWNER's language: exactly what the homeowner will see.
  const cookieT = await getT();
  const locale = sales && isLocale(snap.language) ? snap.language : cookieT.locale;
  const t = sales ? makeT(locale) : cookieT.t;
  const selected = q.selectedOption ?? out.recommendedIndex;
  const sub = out.options.find((o) => o.subsidyRuleId)?.subsidyRuleId;
  const [rule] = sub ? await db.select().from(subsidyRules).where(eq(subsidyRules.id, sub)).limit(1) : [];
  const [project] = q.status === "accepted" ? await db.select().from(projects).where(eq(projects.quoteId, q.id)).limit(1) : [];
  const validUntil = q.validUntil ? formatDateIST(q.validUntil) : null;
  const acceptOptions = out.options.map((o, i) => ({
    index: i, label: `${t("quote.kwOption", { kw: o.kw })} · ${t(`quote.tier.${o.tier}`)}`, net: formatINR(o.netPaise), advance: formatINR(percentOfPaise(o.netPaise, ADVANCE_BP)),
  }));

  return (
    <section>
      {sales ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-hairline pb-4">
          <Chip>Preview as the homeowner sees it ({locale})</Chip><Chip>{q.status}</Chip><span className="num text-sm text-muted">v{q.version} · {q.lead.humanId}</span>
          <Link className="ml-auto underline underline-offset-4" href={`/leads/${q.lead.id}`}>Back to lead</Link>
        </div>
      ) : null}
      <h1 className="display mb-6 text-3xl">{t("quote.title")}</h1>

      {q.status === "accepted" ? (
        <div className="mb-8 border-l-4 border-support bg-surface p-4" role="status">
          <p className="display mb-1 text-2xl">{t("quote.accepted.title")}</p>
          <p className="mb-4">{t("quote.accepted.body", { amount: formatINR(percentOfPaise(out.options[selected].netPaise, ADVANCE_BP)) })}</p>
          {project ? <LinkButton href={`/projects/${project.id}`}>{t("quote.accepted.cta")}</LinkButton> : null}
        </div>
      ) : null}
      {q.status === "expired" ? <p role="alert" className="mb-6 border-l-4 border-warn bg-surface p-3 font-semibold">{t("quote.expired")}</p> : null}

      <QuoteStory t={t} options={out.options} selected={selected} recommendedIndex={out.recommendedIndex} settings={snap.settings} validUntil={validUntil} subsidyVerified={rule?.verified} />

      <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-muted">
        {validUntil ? <span>{t("quote.validUntil", { date: validUntil })}</span> : null}
        <a className="underline underline-offset-4" href={`/api/quotes/${q.id}/pdf${sales ? `?lang=${locale}` : ""}`}>{t("quote.pdf")}</a>
      </div>
      {sales && rule ? <p className="mb-6 border-l-2 border-hairline pl-3 text-sm text-muted">Rule used: {rule.scheme}, effective from {formatDateIST(rule.effectiveFrom)}, {rule.verified ? "verified" : "UNVERIFIED (assumption A1)"}.</p> : null}

      {!sales && q.status === "sent" ? <AcceptForm quoteId={q.id} options={acceptOptions} selected={selected} messages={messagesFor(locale, ["quote.", "common."])} /> : null}
    </section>
  );
}
