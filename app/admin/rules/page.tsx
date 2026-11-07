import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appSettings, priceRules, projectStages, subsidyRules } from "@/db/schema";
import { Chip } from "@/components/ui/Chip";
import { requireSalesUser } from "@/lib/auth/current";
import { formatINR } from "@/lib/rules/money";
import { formatDateIST } from "@/lib/sales/format";

export const metadata = { title: "Rules" };
const to = (d: Date | null) => (d ? formatDateIST(d) : "open");

export default async function Rules() {
  const user = await requireSalesUser();
  if (!user.isAdmin) notFound(); // admin flag only (A15)
  const db = getDb();
  const [subs, prices, settings, stages] = await Promise.all([
    db.select().from(subsidyRules).orderBy(asc(subsidyRules.effectiveFrom)),
    db.select().from(priceRules).orderBy(asc(priceRules.kw), asc(priceRules.tier), asc(priceRules.effectiveFrom)),
    db.select().from(appSettings).orderBy(asc(appSettings.key), asc(appSettings.effectiveFrom)),
    db.select().from(projectStages).orderBy(asc(projectStages.order)),
  ]);
  return (
    <section>
      <h1 className="display mb-2 text-4xl">Rules</h1>
      <p className="mb-8 border-l-2 border-hairline pl-3 text-sm text-muted">Read-only view of the dated tables. To change a rule, add a new row with a new effective date (see the <code>rules-engine</code> skill); sent quotes keep the rules they were priced with. An editing screen is on the cut list.</p>

      <h2 className="display mb-2 text-2xl">Subsidy</h2>
      <ul className="mb-8 divide-y divide-hairline border-y border-hairline">
        {subs.map((r) => (
          <li key={r.id} className="py-3">
            <p className="font-semibold">{r.scheme} <Chip kind={r.verified ? "high" : "warn"}>{r.verified ? "verified" : "UNVERIFIED"}</Chip></p>
            <p className="num text-muted">{r.customerType}: {formatINR(r.perKwPaise)}/kW up to {r.firstKwLimit} kW + {formatINR(r.extraKwPaise)} next kW, cap {formatINR(r.capPaise)} · {formatDateIST(r.effectiveFrom)} to {to(r.effectiveTo)}</p>
            <p className="text-sm text-muted">{r.sourceNote}</p>
          </li>
        ))}
      </ul>

      <h2 className="display mb-2 text-2xl">System prices</h2>
      <ul className="mb-8 grid gap-x-8 sm:grid-cols-2">
        {prices.map((r) => <li key={r.id} className="num flex justify-between border-b border-hairline py-1"><span>{r.kw} kW {r.tier}</span><span>{formatINR(r.pricePaise)} <span className="text-sm text-muted">from {formatDateIST(r.effectiveFrom)}</span></span></li>)}
      </ul>

      <h2 className="display mb-2 text-2xl">Settings</h2>
      <ul className="mb-8 divide-y divide-hairline border-y border-hairline">
        {settings.map((r) => <li key={r.key + r.effectiveFrom.toISOString()} className="num flex justify-between py-2"><span>{r.key}</span><span>{r.value} <span className="text-sm text-muted">from {formatDateIST(r.effectiveFrom)}</span></span></li>)}
      </ul>

      <h2 className="display mb-2 text-2xl">Project stages and stuck thresholds</h2>
      <ul className="divide-y divide-hairline border-y border-hairline">
        {stages.map((s) => <li key={s.code} className="flex justify-between py-2"><span>{s.order}. {s.labelEn}</span><span className="num text-muted">{s.stuckAfterDays === null ? "final" : `stuck after ${s.stuckAfterDays} days`}</span></li>)}
      </ul>
    </section>
  );
}
