import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { quotes } from "@/db/schema";
import { LinkButton } from "@/components/ui/Button";
import { SalesLeadDetail } from "@/components/sales/SalesLeadDetail";
import { getUser } from "@/lib/auth/current";
import { getLeadFor } from "@/lib/data/leads";
import { getT, type MessageKey } from "@/lib/i18n";

export const metadata = { title: "Your solar estimate" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/signin");
  const lead = await getLeadFor(getDb(), user, id);
  if (!lead) notFound();
  if (user.role === "sales") return <SalesLeadDetail lead={lead} user={user} />;

  const { t } = await getT();
  if (lead.status === "bill_review") {
    return (
      <section>
        <h1 className="display mb-4 text-3xl">{t("result.title")}</h1>
        <p className="mb-6">{t("result.pending")}</p>
        <LinkButton href={`/leads/${lead.id}/bill`}>{t("result.checkBill")}</LinkButton>
      </section>
    );
  }
  const band = lead.scoreBand ?? "medium";
  const reasons = (lead.scoreReasons ?? []) as string[];
  const kw = lead.recommendedKw ? Number(lead.recommendedKw) : null;
  const [sent] = await getDb().select({ id: quotes.id, status: quotes.status }).from(quotes)
    .where(and(eq(quotes.leadId, lead.id), inArray(quotes.status, ["sent", "accepted"]))).orderBy(desc(quotes.createdAt)).limit(1);
  const why = reasons.filter((r) => r !== "needs_human_check")[0] ?? reasons[0];
  const lowBody = reasons.includes("tenant") ? "result.low.tenant" : "result.low.small";

  return (
    <section>
      <p className="num mb-1 text-sm text-muted">{t("result.refId", { id: lead.humanId })}</p>
      <h1 className="display mb-4 text-4xl">{t(`result.${band}.title` as MessageKey)}</h1>
      {kw && band !== "low" ? (
        <div className="mb-6 border-y border-hairline py-4">
          <p className="text-sm text-muted">{t("result.size")}</p>
          <p className="display num text-6xl">{kw} <span className="text-2xl">{t("common.kw")}</span></p>
        </div>
      ) : null}
      <p className="mb-4 text-lg">
        {band === "low" ? t(lowBody as MessageKey) : t(`result.${band}.body` as MessageKey, { kw: kw ?? "" })}
      </p>
      {why ? <p className="mb-4 text-muted">{t("result.why", { why: t(`result.why.${why}` as MessageKey) })}</p> : null}
      {lead.needsHumanCheck && !reasons.includes("needs_human_check") ? <p className="mb-4 text-muted">{t("result.why", { why: t("result.why.needs_human_check") })}</p> : null}
      {lead.customerType === "commercial" ? <p className="mb-4 border-l-4 border-ink bg-surface p-3">{t("result.commercial")}</p> : null}
      <p className="mb-8 text-sm text-muted">{t("result.messageSent", { phone: user.phone })}</p>
      {sent ? <LinkButton href={`/quotes/${sent.id}`}>{t("quote.title")}</LinkButton> : <Link href="/" className="inline-flex min-h-12 items-center underline underline-offset-4">{t("common.home")}</Link>}
    </section>
  );
}
