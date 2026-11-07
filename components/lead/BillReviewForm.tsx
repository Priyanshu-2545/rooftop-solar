"use client";
import { useActionState, useState } from "react";
import { confirmBillAction, reuploadAction, type BillFormState } from "@/app/actions/leads";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { tFrom, type MessageKey } from "@/lib/i18n/make-t";
import type { BillFieldKey } from "@/lib/ai/schema";

export type ReviewField = { key: BillFieldKey; value: string | null; confidence: number | null; flag?: "implausible" | "bad_format" | "missing" };
const SURE = 0.85;
const numeric = (k: BillFieldKey) => k === "sanctionedLoadKw" || k === "avgUnitsMonth" || k === "consumerNo";

/** Image beside the values it produced (Proximity + Common Region). The AI shows its work; a person decides. */
export function BillReviewForm({ leadId, imageSrc, fields, mode, messages, submitLabelKey = "bill.confirm" }: {
  leadId: string; imageSrc: string | null; fields: ReviewField[]; mode: "review" | "manual" | "edit";
  messages: Record<string, string>; submitLabelKey?: MessageKey;
}) {
  const t = tFrom(messages);
  const [state, action, pending] = useActionState<BillFormState, FormData>(confirmBillAction, null);
  const [choice, setChoice] = useState<Partial<Record<BillFieldKey, "ok" | "fix">>>(() => {
    const init: Partial<Record<BillFieldKey, "ok" | "fix">> = {};
    for (const f of fields) {
      if (f.value === null || mode !== "review") init[f.key] = "fix"; // nothing read, or typing by hand
      else if (f.confidence !== null && f.confidence >= SURE && !f.flag) init[f.key] = "ok"; // sure: pre-selected
      // "check this" fields start unselected: the person must choose
    }
    return init;
  });
  return (
    <form action={action} noValidate>
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="mode" value={mode} />
      <div className="grid gap-6 md:grid-cols-2">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- authorised same-origin route, already downscaled server-side
          <img src={imageSrc} alt={t("bill.photoAlt")} loading="lazy" className="w-full rounded-md border border-hairline bg-surface object-contain md:sticky md:top-4 md:max-h-[70vh]" />
        ) : null}
        <div className="border border-hairline bg-surface p-4">
          {fields.map((f) => {
            const c = choice[f.key];
            const err = state?.errors?.[f.key];
            const missing = f.value === null;
            const sure = f.confidence !== null && f.confidence >= SURE && !f.flag;
            const editing = mode !== "review" || missing || c === "fix";
            return (
              <fieldset key={f.key} className="border-b border-hairline py-4 first:pt-0 last:border-b-0 last:pb-0">
                <legend className="mb-1 flex w-full items-center justify-between gap-2 font-semibold">
                  <span>{t(`bill.field.${f.key}` as MessageKey)}</span>
                  {mode === "review" && !missing ? <Chip kind={sure ? "high" : "warn"}>{sure ? t("bill.sure") : t("bill.check")}</Chip> : null}
                </legend>
                {missing && mode === "review" ? <p className="mb-2 text-sm text-warn">{t("bill.missing")}</p> : null}
                {f.flag === "implausible" ? <p className="mb-2 text-sm text-warn">{t("bill.flag.implausible")}</p> : null}
                {!editing ? <p className="num mb-2 text-xl">{f.value}</p> : null}
                {editing ? (
                  <input
                    name={`value_${f.key}`} defaultValue={f.value ?? ""} aria-label={t(`bill.field.${f.key}` as MessageKey)}
                    inputMode={numeric(f.key) ? "decimal" : "text"} autoComplete="off" maxLength={60}
                    aria-invalid={err ? true : undefined}
                    className="num mb-2 block min-h-12 w-full rounded-md border border-ink/40 bg-surface px-3 text-[17px] aria-[invalid=true]:border-2 aria-[invalid=true]:border-warn"
                  />
                ) : null}
                {mode === "review" && !missing ? (
                  <div className="flex gap-4" role="radiogroup">
                    {(["ok", "fix"] as const).map((d) => (
                      <label key={d} className="flex min-h-12 items-center gap-2">
                        <input type="radio" name={`decision_${f.key}`} value={d} checked={c === d} onChange={() => setChoice((o) => ({ ...o, [f.key]: d }))} className="h-5 w-5 accent-[var(--ink)]" />
                        {t(d === "ok" ? "bill.looksRight" : "bill.fix")}
                      </label>
                    ))}
                  </div>
                ) : null}
                <p role="alert" className={err ? "mt-1 text-sm font-semibold text-warn" : "sr-only"}>{err ? t(err) : ""}</p>
              </fieldset>
            );
          })}
        </div>
      </div>
      {state?.server ? <p role="alert" className="mt-4 font-semibold text-warn">{t(state.server)}</p> : null}
      <div className="fixed inset-x-0 bottom-0 border-t border-hairline bg-surface">
        <div className="mx-auto flex max-w-[560px] px-4 py-3 md:max-w-[1100px]">
          <Button disabled={pending}>{pending ? t("bill.confirming") : t(submitLabelKey)}</Button>
        </div>
      </div>
    </form>
  );
}

export function ReuploadForm({ leadId, messages, attempt, max, reason, demo, samples }: {
  leadId: string; messages: Record<string, string>; attempt: number; max: number; reason: string; demo: boolean; samples: { file: string; label: string }[];
}) {
  const t = tFrom(messages);
  const [state, action, pending] = useActionState<BillFormState, FormData>(reuploadAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="leadId" value={leadId} />
      <h1 className="display mb-3 text-3xl">{t("bill.poor.title")}</h1>
      <p className="mb-2">{t("bill.poor.body", { reason })}</p>
      <p className="num mb-6 text-sm text-muted">{t("bill.attempts", { n: attempt, max })}</p>
      <label htmlFor="photo" className="mb-1 block font-semibold">{t("lead.photo")}</label>
      <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/*" capture="environment" className="mb-4 block min-h-12 w-full rounded-md border border-ink/40 bg-surface p-3" />
      {demo ? (
        <select name="sample" aria-label={t("lead.demoSample")} className="mb-4 block min-h-12 w-full rounded-md border border-ink/40 bg-surface px-3">
          <option value="">{t("lead.demoSampleNone")}</option>
          {samples.map((s) => <option key={s.file} value={s.file}>{s.label}</option>)}
        </select>
      ) : null}
      <p role="alert" className={state?.server ? "mb-4 font-semibold text-warn" : "sr-only"}>{state?.server ? t(state.server) : ""}</p>
      <p aria-live="polite" className="mb-2 min-h-6 font-semibold">{pending ? t("bill.status.reading") : ""}</p>
      <Button disabled={pending}>{t("bill.reupload")}</Button>
    </form>
  );
}
