"use client";
import { useActionState } from "react";
import { moveStageAction, statusLinkAction, type LinkState, type MoveState } from "@/app/actions/projects";
import { Button } from "@/components/ui/Button";

const box = "block min-h-12 w-full rounded-md border border-ink/40 bg-surface px-3";

export function MoveStageForm({ projectId, options }: { projectId: string; options: { code: string; label: string }[] }) {
  const [state, action, pending] = useActionState<MoveState, FormData>(moveStageAction, null);
  if (options.length === 0) return <p className="text-muted">This project is complete.</p>;
  return (
    <form action={action}>
      <input type="hidden" name="projectId" value={projectId} />
      <label className="mb-4 block">Move to<select name="toStage" className={`${box} mt-1`} defaultValue={options[0].code}>{options.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></label>
      <label className="mb-4 block">Note (optional)<textarea name="note" rows={2} maxLength={500} className={`${box} mt-1 py-2`} /></label>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <label className="block">Attach a document (PDF, JPG, PNG)<input type="file" name="document" accept="application/pdf,image/jpeg,image/png" className={`${box} mt-1 p-3`} /></label>
        <label className="block">Document type<input name="kind" defaultValue="document" maxLength={40} className={`${box} mt-1`} /></label>
      </div>
      <Button disabled={pending}>{pending ? "Moving…" : "Move stage and message customer"}</Button>
      {state?.error ? <p role="alert" className="mt-3 font-semibold text-warn">{state.error}</p> : null}
      {state?.ok && state.message ? (
        <div role="status" className="mt-4 border-l-4 border-support bg-surface p-3">
          <p className="mb-1 text-sm font-semibold">Message sent (demo, not a real SMS):</p>
          <p className="text-muted">{state.message}</p>
        </div>
      ) : null}
    </form>
  );
}

export function StatusLinkPanel({ projectId, hasLink, revoked }: { projectId: string; hasLink: boolean; revoked: boolean }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(statusLinkAction, null);
  return (
    <div>
      <p className="mb-3 text-muted">
        {state?.revoked ? "Link revoked." : hasLink ? (revoked ? "The link is revoked." : "A link exists. Only its hash is stored, so make a new one to copy it again.") : "No link yet."}
      </p>
      <form action={action} className="flex flex-wrap gap-3">
        <input type="hidden" name="projectId" value={projectId} />
        <Button name="intent" value="create" variant="secondary" disabled={pending}>{hasLink ? "Regenerate link" : "Create link"}</Button>
        {hasLink && !revoked ? <Button name="intent" value="revoke" variant="quiet" disabled={pending}>Revoke</Button> : null}
      </form>
      {state?.url ? (
        <p role="status" className="num mt-3 break-all border-l-4 border-support bg-surface p-3">
          <span className="block text-sm font-semibold">Copy it now (shown once):</span>
          <span className="select-all">{state.url}</span>
        </p>
      ) : null}
      {state?.error ? <p role="alert" className="mt-3 text-warn">{state.error}</p> : null}
    </div>
  );
}
