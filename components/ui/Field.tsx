import type { InputHTMLAttributes, ReactNode } from "react";

/** Label above (never placeholder-only), hint, and an inline error announced to screen readers. */
export function Field({
  id, label, hint, error, children,
}: { id: string; label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="mb-6">
      <label htmlFor={id} className="mb-1 block font-semibold">{label}</label>
      {hint ? <p id={`${id}-hint`} className="mb-2 text-sm text-muted">{hint}</p> : null}
      {children}
      <p id={`${id}-err`} role="alert" className={error ? "mt-2 text-sm font-semibold text-warn" : "sr-only"}>
        {error ?? ""}
      </p>
    </div>
  );
}

export const inputClass =
  "block min-h-12 w-full rounded-md border border-ink/40 bg-surface px-3 text-[17px] text-ink aria-[invalid=true]:border-warn aria-[invalid=true]:border-2";

export function TextInput({ id, error, hint, ...p }: InputHTMLAttributes<HTMLInputElement> & { id: string; error?: string | null; hint?: boolean }) {
  return (
    <input
      id={id}
      name={p.name ?? id}
      aria-invalid={error ? true : undefined}
      aria-describedby={`${hint ? `${id}-hint ` : ""}${id}-err`}
      {...p}
      className={`${inputClass} ${p.className ?? ""}`}
    />
  );
}
