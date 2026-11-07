"use client";
import { useActionState, useMemo, useState } from "react";
import { saveQuoteAction, type QuoteFormState } from "@/app/actions/quotes";
import { Button } from "@/components/ui/Button";
import { QuoteStory } from "@/components/quote/QuoteStory";
import { tFrom } from "@/lib/i18n/make-t";
import { computeOption, NoPriceError, type OptionOutput, type PriceRule, type Tier } from "@/lib/quote/compute";
import { ruleIdsOf, type Selection } from "@/lib/quote/service-shared";
import { formatINR } from "@/lib/rules/money";
import type { QuoteSettings } from "@/lib/rules/settings";
import type { SubsidyRule } from "@/lib/rules/subsidy";

type Dated<T> = Omit<T, "effectiveFrom" | "effectiveTo"> & { effectiveFrom: string; effectiveTo: string | null };
const rehydrate = <T extends { effectiveFrom: Date; effectiveTo: Date | null }>(rows: Dated<T>[]): T[] =>
  rows.map((r) => ({ ...r, effectiveFrom: new Date(r.effectiveFrom), effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null }) as unknown as T);

const sel = "block min-h-12 w-full rounded-md border border-ink/40 bg-surface px-3";

export function QuoteBuilder(p: {
  leadId: string; recommendedKw: number; roofNote: string | null; customerType: "residential" | "commercial";
  priceRules: Dated<PriceRule>[]; subsidyRules: Dated<SubsidyRule>[]; settings: QuoteSettings;
  initial: Selection[]; messages: Record<string, string>; ruleNote: string | null; validUntilText: string;
}) {
  const t = tFrom(p.messages);
  const [state, action, pending] = useActionState<QuoteFormState, FormData>(saveQuoteAction, null);
  const [rows, setRows] = useState<Selection[]>(p.initial);
  const [preview, setPreview] = useState(() => Math.max(0, p.initial.findIndex((s) => s.kw === Math.round(p.recommendedKw))));
  const price = useMemo(() => rehydrate<PriceRule>(p.priceRules), [p.priceRules]);
  const subsidy = useMemo(() => rehydrate<SubsidyRule>(p.subsidyRules), [p.subsidyRules]);

  const { options, errors } = useMemo(() => {
    const on = new Date();
    const out: (OptionOutput | null)[] = [];
    const errs: (string | null)[] = [];
    for (const r of rows) {
      try {
        out.push(computeOption({ ...r, customerType: p.customerType, on, priceRules: price, subsidyRules: subsidy, settings: p.settings }));
        errs.push(null);
      } catch (e) {
        out.push(null);
        errs.push(e instanceof NoPriceError ? `No price for ${r.kw} kW ${r.tier} today` : "Invalid size");
      }
    }
    return { options: out, errors: errs };
  }, [rows, price, subsidy, p.settings, p.customerType]);

  const valid = options.every((o): o is OptionOutput => o !== null);
  const good = valid ? (options as OptionOutput[]) : [];
  const idx = Math.min(preview, Math.max(good.length - 1, 0));
  const update = (i: number, patch: Partial<Selection>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <form action={action}>
      <input type="hidden" name="leadId" value={p.leadId} />
      <input type="hidden" name="selections" value={JSON.stringify(rows)} />
      <input type="hidden" name="shownRuleIds" value={JSON.stringify(valid ? ruleIdsOf(good) : [])} />

      <p className="mb-4 text-muted">Recommended from the bill: <strong className="num text-ink">{p.recommendedKw} kW</strong>. Up to 3 options.</p>
      {p.roofNote ? <p role="status" className="mb-4 border-l-4 border-warn bg-surface p-3">{p.roofNote}</p> : null}
      {p.customerType === "commercial" ? <p className="mb-4 border-l-4 border-ink bg-surface p-3">Small-business connection: no residential subsidy applies.</p> : null}

      <ul className="mb-4 divide-y divide-hairline border-y border-hairline">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-3 py-3">
            <label className="block"><span className="sr-only">Size {i + 1}</span>
              <select aria-label={`Option ${i + 1} size`} className={sel} value={r.kw} onChange={(e) => update(i, { kw: Number(e.target.value) })}>
                {Array.from({ length: 10 }, (_, k) => k + 1).map((k) => <option key={k} value={k}>{k} kW</option>)}
              </select></label>
            <label className="block"><span className="sr-only">Panels {i + 1}</span>
              <select aria-label={`Option ${i + 1} panels`} className={sel} value={r.tier} onChange={(e) => update(i, { tier: e.target.value as Tier })}>
                <option value="standard">Standard panels</option><option value="premium">Premium panels</option>
              </select></label>
            {rows.length > 1 ? <button type="button" className="min-h-12 px-2 text-sm text-muted underline underline-offset-4" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}>Remove</button> : <span />}
            {errors[i] ? <p role="alert" className="col-span-3 text-sm font-semibold text-warn">{errors[i]}</p> : options[i] ? (
              <p className="num col-span-3 text-sm text-muted">{formatINR(options[i]!.grossPaise)} − {formatINR(options[i]!.subsidyPaise)} subsidy = <strong className="text-ink">{formatINR(options[i]!.netPaise)}</strong> · {options[i]!.generationUnits.toLocaleString("en-IN")} units/yr · payback {options[i]!.paybackYears ?? "—"} yr
                <label className="ml-3 inline-flex items-center gap-1"><input type="radio" name="previewPick" checked={idx === i} onChange={() => setPreview(i)} className="h-4 w-4" />preview</label></p>
            ) : null}
          </li>
        ))}
      </ul>
      {rows.length < 3 ? <Button type="button" variant="secondary" className="mb-6" onClick={() => setRows((rs) => [...rs, { kw: Math.min(Math.round(p.recommendedKw) + rs.length, 10), tier: "standard" }])}>Add option</Button> : null}
      {p.ruleNote ? <p className="mb-6 border-l-2 border-hairline pl-3 text-sm text-muted">{p.ruleNote}</p> : null}

      {state?.error ? <p role="alert" className="mb-4 font-semibold text-warn">{state.error}</p> : null}
      {state?.warning ? <p role="alert" className="mb-4 border-l-4 border-warn bg-surface p-3 font-semibold">{state.warning}</p> : null}

      <h2 className="display mb-1 mt-10 text-2xl">What the homeowner sees</h2>
      <p className="mb-4 text-sm text-muted">Exactly this, in their language.</p>
      <div className="mb-8 max-w-[560px] border border-hairline p-4">
        {valid && good.length > 0 ? (
          <QuoteStory t={t} options={good} selected={idx} recommendedIndex={Math.max(0, rows.findIndex((r) => r.kw === Math.round(p.recommendedKw)))} settings={p.settings} validUntil={p.validUntilText} subsidyVerified={false} />
        ) : <p className="text-muted">Fix the options above to see the preview.</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-hairline bg-surface">
        <div className="mx-auto flex max-w-[1100px] gap-3 px-4 py-3">
          <Button name="intent" value="draft" variant="secondary" disabled={pending || !valid}>Save draft</Button>
          <Button name="intent" value="send" disabled={pending || !valid}>{pending ? "Working…" : "Send quote"}</Button>
        </div>
      </div>
      <div className="h-16" aria-hidden="true" />
    </form>
  );
}
