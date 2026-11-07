import { SunArc } from "@/components/ui/SunArc";
import { stageLabel, stageNext, type StageRow } from "@/lib/projects/labels";
import { progressOf, splitTimeline } from "@/lib/projects/stuck";
import type { Locale, T } from "@/lib/i18n/make-t";

/**
 * Sun position = project progress (Goal-Gradient). Shows the current stage and the next few;
 * finished and later stages are collapsed (Miller). Used by the tracker and the public status page.
 */
export function StageTimeline({ t, locale, stages, current, since }: { t: T; locale: Locale; stages: StageRow[]; current: string; since: string }) {
  const cur = stages.find((s) => s.code === current) ?? stages[0];
  const { done, visible, later } = splitTimeline(stages, current);
  const finished = cur.order === stages.length;
  const item = (s: StageRow, state: "done" | "now" | "next") => (
    <li key={s.code} className={`flex items-baseline gap-3 border-b border-hairline py-2 ${state === "now" ? "font-bold" : state === "done" ? "text-muted" : ""}`}>
      <span aria-hidden="true" className="num w-6 text-sm text-muted">{s.order}</span>
      <span>{stageLabel(s, locale)}</span>
      {state === "now" ? <span className="sr-only"> (current)</span> : null}
    </li>
  );
  return (
    <div>
      <SunArc progress={progressOf(stages, current)} label={t("status.progress", { n: cur.order - (finished ? 0 : 1), total: stages.length })} className="mx-auto mb-2 max-w-[300px]" />
      <p className="num mb-6 text-center text-sm text-muted">{t("status.progress", { n: cur.order - (finished ? 0 : 1), total: stages.length })}</p>

      <p className="text-sm text-muted">{t("status.where")}</p>
      <p className="display mb-1 text-4xl">{stageLabel(cur, locale)}</p>
      <p className="mb-6 text-sm text-muted">{t("status.since", { date: since })}</p>

      <p className="text-sm text-muted">{t("status.next")}</p>
      <p className="mb-2 text-lg">{finished ? t("status.done") : stageNext(cur, locale)}</p>
      {cur.stuckAfterDays !== null ? <p className="mb-6 text-sm text-muted">{t("status.expected", { days: cur.stuckAfterDays })}</p> : <div className="mb-6" />}

      <ol className="mb-2 border-t border-hairline" aria-label={t("status.stepsAll")}>
        {visible.map((s, i) => item(s, i === 0 ? "now" : "next"))}
      </ol>
      {done.length || later.length ? (
        <details className="mb-4">
          <summary className="flex min-h-12 items-center underline underline-offset-4">{t("status.stepsAll")}</summary>
          <ol>{[...done.map((s) => item(s, "done")), ...later.map((s) => item(s, "next"))]}</ol>
        </details>
      ) : null}
    </div>
  );
}
