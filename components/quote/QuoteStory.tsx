import { SunArc } from "@/components/ui/SunArc";
import type { OptionOutput } from "@/lib/quote/compute";
import type { QuoteSettings } from "@/lib/rules/settings";
import type { T, MessageKey } from "@/lib/i18n/make-t";
import { formatINR } from "@/lib/rules/money";

export type StoryProps = {
  t: T;
  options: OptionOutput[];
  selected: number;
  recommendedIndex: number;
  settings: QuoteSettings;
  validUntil: string | null; // already formatted for display
  subsidyVerified?: boolean;
};

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2 last:border-b-0">
    <dt className="text-muted">{label}</dt>
    <dd className={`num text-right ${strong ? "font-bold" : ""}`}>{value}</dd>
  </div>
);

/**
 * The quote as a simple story (Visual Hierarchy + Progressive Disclosure):
 * 1) three big serif numbers  2) one sentence  3) details behind a disclosure.
 * Used by the homeowner page, the sales preview and mirrored by the PDF.
 */
export function QuoteStory({ t, options, selected, recommendedIndex, settings, validUntil, subsidyVerified }: StoryProps) {
  const o = options[selected];
  const years = o.paybackYears;
  return (
    <div>
      <div className="mb-6">
        <SunArc progress={years === null ? 0 : Math.min(years / 25, 1)} label={years === null ? t("quote.title") : `${t("quote.payback")} ${years} / 25 ${t("common.years")}`} className="mx-auto max-w-[300px]" />
      </div>

      {/* Common Region: the three-number block sits in one surface */}
      <div className="mb-6 border-y border-hairline bg-surface px-4 py-6">
        <div className="mb-6">
          <p className="text-sm text-muted">{t("quote.size")}</p>
          <p className="display num text-6xl leading-none">{o.kw} <span className="text-2xl">{t("common.kw")}</span></p>
        </div>
        <div className="mb-6">
          <p className="text-sm text-muted">{t("quote.net")}</p>
          <p className="display num text-6xl leading-none">{formatINR(o.netPaise)}</p>
        </div>
        <div>
          <p className="text-sm text-muted">{t("quote.payback")}</p>
          <p className="display num text-6xl leading-none text-support">
            {years === null ? "—" : years} <span className="text-2xl">{t("common.years")}</span>
          </p>
        </div>
      </div>

      <p className="mb-8 text-lg">
        {years === null ? t("quote.summaryNoPayback", { kw: o.kw, net: formatINR(o.netPaise) }) : t("quote.summary", { kw: o.kw, net: formatINR(o.netPaise), years })}
      </p>

      <details className="mb-8 border-t border-hairline">
        <summary className="flex min-h-12 items-center py-2 text-lg font-semibold underline underline-offset-4">{t("quote.how")}</summary>
        <div className="pb-4">
          {options.length > 1 ? (
            <div className="mb-6">
              <h2 className="mb-2 font-semibold">{t("quote.options")}</h2>
              <ul className="divide-y divide-hairline border-y border-hairline">
                {options.map((x, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 py-2">
                    <span>
                      <span className="num font-semibold">{t("quote.kwOption", { kw: x.kw })}</span>{" "}
                      <span className="text-sm text-muted">{t(`quote.tier.${x.tier}` as MessageKey)}</span>
                      {i === recommendedIndex ? <span className="ml-2 text-sm font-semibold">{t("quote.recommended")}</span> : null}
                    </span>
                    <span className="num">{formatINR(x.netPaise)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <dl className="mb-6">
            <Row label={t("quote.gross")} value={formatINR(o.grossPaise)} />
            <Row label={t("quote.subsidy")} value={o.subsidyPaise > 0 ? `− ${formatINR(o.subsidyPaise)}` : t("quote.noSubsidy")} />
            <Row label={t("quote.net")} value={formatINR(o.netPaise)} strong />
            <Row label={t("quote.generation")} value={`${o.generationUnits.toLocaleString("en-IN")} ${t("common.units")}`} />
            <Row label={t("quote.savings")} value={formatINR(o.yearlySavingsPaise)} />
            <Row label={t("quote.lifetime")} value={formatINR(o.lifetimeSavingsPaise)} />
          </dl>
          <h2 className="mb-2 font-semibold">{t("quote.assumptions")}</h2>
          <ul className="mb-6 list-disc space-y-1 pl-5 text-muted">
            <li>{t("quote.assume.tariff", { rate: formatINR(settings.tariffPaisePerUnit) })}</li>
            <li>{t("quote.assume.gen", { units: settings.unitsPerKwYear.toLocaleString("en-IN") })}</li>
            {settings.escalationBp === 0 ? <li>{t("quote.assume.flat")}</li> : null}
            {o.subsidyPaise > 0 && subsidyVerified === false ? <li>{t("quote.assume.unverified")}</li> : null}
            <li>{t("quote.explain.payback")}</li>
            <li>{t("quote.explain.netMetering")}</li>
          </ul>
          <h2 className="mb-2 font-semibold">{t("quote.terms")}</h2>
          <p className="text-muted">{t("quote.terms.body", { date: validUntil ?? "—" })}</p>
        </div>
      </details>
    </div>
  );
}
