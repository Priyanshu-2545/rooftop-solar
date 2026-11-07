"use client";
import { useActionState, useState, useTransition } from "react";
import { revealConsumerAction, saveSurveyAction, scheduleAction, type SimpleState } from "@/app/actions/sales";
import { Button } from "@/components/ui/Button";

const box = "block min-h-12 w-full rounded-md border border-ink/40 bg-surface px-3";

export function RevealConsumer({ leadId, masked }: { leadId: string; masked: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-3">
      <span className="num text-xl" aria-live="polite">{value ?? masked}</span>
      {value === null ? (
        <button type="button" disabled={pending} onClick={() => start(async () => setValue((await revealConsumerAction(leadId)) ?? masked))}
          className="min-h-12 px-2 text-sm underline underline-offset-4">{pending ? "…" : "Show (logged)"}</button>
      ) : null}
    </span>
  );
}

function Status({ state }: { state: SimpleState }) {
  return <p role={state?.error ? "alert" : "status"} className={`mt-3 min-h-6 text-sm font-semibold ${state?.error ? "text-warn" : "text-support"}`}>{state?.error ?? (state?.ok ? "Saved." : "")}</p>;
}

export function SurveyForm({ leadId, initial }: { leadId: string; initial?: { roofOk: boolean; usable: number | null; shading: string; notes: string | null } }) {
  const [state, action, pending] = useActionState<SimpleState, FormData>(saveSurveyAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="leadId" value={leadId} />
      <fieldset className="mb-4"><legend className="mb-1 font-semibold">Roof suitable?</legend>
        <label className="mr-6 inline-flex min-h-12 items-center gap-2"><input type="radio" name="roofOk" value="yes" defaultChecked={initial?.roofOk ?? true} className="h-5 w-5" />Yes</label>
        <label className="inline-flex min-h-12 items-center gap-2"><input type="radio" name="roofOk" value="no" defaultChecked={initial ? !initial.roofOk : false} className="h-5 w-5" />No</label>
      </fieldset>
      <label className="mb-4 block">Usable area (sq ft)<input name="usableArea" inputMode="numeric" maxLength={7} defaultValue={initial?.usable ?? ""} className={`${box} mt-1`} /></label>
      <label className="mb-4 block">Shading
        <select name="shading" defaultValue={initial?.shading ?? "none"} className={`${box} mt-1`}><option value="none">None</option><option value="some">Some</option><option value="heavy">Heavy</option></select></label>
      <label className="mb-4 block">Notes<textarea name="notes" maxLength={1000} rows={3} defaultValue={initial?.notes ?? ""} className={`${box} mt-1 py-2`} /></label>
      <Button variant="secondary" disabled={pending}>{pending ? "Saving…" : "Save survey"}</Button>
      <Status state={state} />
    </form>
  );
}

export function ScheduleForm({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState<SimpleState, FormData>(scheduleAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="leadId" value={leadId} />
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <label className="block">Type<select name="kind" className={`${box} mt-1`}><option value="call">Short call</option><option value="visit">Survey visit</option></select></label>
        <label className="block">Date<input type="date" name="date" required className={`${box} mt-1`} /></label>
      </div>
      <Button variant="secondary" disabled={pending}>{pending ? "Sending…" : "Schedule and message customer"}</Button>
      <Status state={state} />
    </form>
  );
}
