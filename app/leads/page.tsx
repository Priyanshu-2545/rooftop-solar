import Link from "next/link";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { leads, users } from "@/db/schema";
import { Chip, ScoreChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/States";
import { requireSalesUser } from "@/lib/auth/current";
import { ageLabel } from "@/lib/sales/format";
import { formatINR } from "@/lib/rules/money";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Leads" };
const BANDS = ["high", "medium", "low"] as const;
const STATUSES = ["new", "bill_review", "scored", "contacted", "surveyed", "quoted", "won", "closed"] as const;
type SP = { q?: string; band?: string; status?: string; pin?: string };

export default async function Inbox({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSalesUser();
  const { t } = await getT();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 40);
  const band = BANDS.find((b) => b === sp.band);
  const status = STATUSES.find((s) => s === sp.status);
  const pin = /^\d{1,6}$/.test(sp.pin ?? "") ? sp.pin : undefined;
  const like = `%${q.replace(/[%_\\]/g, "")}%`;

  const rows = await getDb()
    .select({ lead: leads, name: users.name, phone: users.phone })
    .from(leads).innerJoin(users, eq(users.id, leads.ownerUserId))
    .where(and(
      q ? or(ilike(users.name, like), ilike(users.phone, like), ilike(leads.humanId, like)) : undefined,
      band ? eq(leads.scoreBand, band) : undefined,
      status ? eq(leads.status, status) : undefined,
      pin ? ilike(leads.pincode, `${pin}%`) : undefined,
    ))
    .orderBy(desc(leads.createdAt)).limit(100);
  const now = new Date();
  const filtered = Boolean(band || status || pin);

  return (
    <section>
      <h1 className="display mb-4 text-4xl">{t("sales.inbox")}</h1>
      <form method="get" className="mb-4 flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">{t("sales.search")}</label>
        <input id="q" name="q" defaultValue={q} placeholder={t("sales.search")} inputMode="search" className="min-h-12 w-full rounded-md border border-ink/40 bg-surface px-3" />
        {band ? <input type="hidden" name="band" value={band} /> : null}
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {pin ? <input type="hidden" name="pin" value={pin} /> : null}
        <button className="min-h-12 rounded-md border border-ink px-4 font-semibold">Search</button>
      </form>
      {/* Hick's law: only the three filters that matter, collapsed by default */}
      <details className="mb-6 border-y border-hairline py-2" open={filtered}>
        <summary className="flex min-h-12 items-center font-semibold">{t("sales.filters")}{filtered ? " (on)" : ""}</summary>
        <form method="get" className="grid gap-4 py-3 md:grid-cols-4">
          <input type="hidden" name="q" value={q} />
          <label className="block">{t("sales.score")}
            <select name="band" defaultValue={band ?? ""} className="mt-1 block min-h-12 w-full rounded-md border border-ink/40 bg-surface px-3">
              <option value="">{t("sales.all")}</option>{BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select></label>
          <label className="block">{t("sales.status")}
            <select name="status" defaultValue={status ?? ""} className="mt-1 block min-h-12 w-full rounded-md border border-ink/40 bg-surface px-3">
              <option value="">{t("sales.all")}</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select></label>
          <label className="block">{t("sales.pincode")}
            <input name="pin" defaultValue={pin ?? ""} inputMode="numeric" maxLength={6} className="mt-1 block min-h-12 w-full rounded-md border border-ink/40 bg-surface px-3" /></label>
          <div className="flex items-end gap-3">
            <button className="min-h-12 rounded-md border border-ink px-4 font-semibold">Apply</button>
            <Link href="/leads" className="inline-flex min-h-12 items-center underline underline-offset-4">Clear</Link>
          </div>
        </form>
      </details>

      {rows.length === 0 ? (
        <EmptyState title={t("sales.empty.leads")} actionHref="/leads" actionLabel="Clear filters" />
      ) : (
        <ul className="divide-y divide-hairline border-y border-hairline">
          <li className="hidden grid-cols-[110px_1.4fr_80px_90px_70px_70px_120px_50px] gap-3 py-2 text-sm text-muted md:grid" aria-hidden="true">
            <span>Lead</span><span>Name</span><span>Score</span><span>Bill</span><span>Units</span><span>kW</span><span>Status</span><span>Age</span>
          </li>
          {rows.map(({ lead: l, name, phone }) => (
            <li key={l.id}>
              <Link href={`/leads/${l.id}`} className="grid min-h-14 grid-cols-2 items-center gap-x-3 gap-y-1 py-3 md:grid-cols-[110px_1.4fr_80px_90px_70px_70px_120px_50px]">
                <span className="num font-semibold">{l.humanId}</span>
                <span className="col-span-1 md:col-span-1">{name}<span className="block text-sm text-muted md:hidden">{l.ownerType} · {phone}</span></span>
                <span><ScoreChip band={l.scoreBand} />{l.needsHumanCheck ? <span className="ml-1 text-xs text-warn">check</span> : null}</span>
                <span className="num">{formatINR(l.monthlyBillPaise)}</span>
                <span className="num hidden md:block">{l.unitsPerMonth ?? "—"}</span>
                <span className="num hidden md:block">{l.recommendedKw ? Number(l.recommendedKw) : "—"}</span>
                <span><Chip>{l.status.replace("_", " ")}</Chip></span>
                <span className="num hidden text-sm text-muted md:block">{ageLabel(l.createdAt, now)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
