"use client";
import { useActionState, useState } from "react";
import { acceptQuoteAction } from "@/app/actions/quotes";
import { Button } from "@/components/ui/Button";
import { tFrom, type MessageKey } from "@/lib/i18n/make-t";

export type AcceptOption = { index: number; label: string; net: string; advance: string };

/** The one clear action, last on the page (Serial Position). Mock payment: no real money. */
export function AcceptForm({ quoteId, options, selected, messages }: { quoteId: string; options: AcceptOption[]; selected: number; messages: Record<string, string> }) {
  const t = tFrom(messages);
  const [state, action, pending] = useActionState(acceptQuoteAction, null);
  const [choice, setChoice] = useState(selected);
  const [key] = useState(() => crypto.randomUUID()); // idempotency key: a double tap is one payment
  const opt = options.find((o) => o.index === choice) ?? options[0];
  return (
    <form action={action} className="border-t border-hairline pt-6">
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="key" value={key} />
      <input type="hidden" name="option" value={choice} />
      {options.length > 1 ? (
        <fieldset className="mb-4">
          <legend className="mb-1 font-semibold">{t("quote.chooseOption")}</legend>
          {options.map((o) => (
            <label key={o.index} className="flex min-h-12 items-center gap-3 border-b border-hairline py-2">
              <input type="radio" name="o" checked={choice === o.index} onChange={() => setChoice(o.index)} className="h-5 w-5 accent-[var(--ink)]" />
              <span className="flex-1">{o.label}</span><span className="num">{o.net}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <p className="num mb-1 text-lg font-semibold">{t("quote.advance", { amount: opt.advance })}</p>
      <p className="mb-4 text-sm text-muted">{t("quote.mockPay")}</p>
      <p role="alert" className={state?.error ? "mb-3 font-semibold text-warn" : "sr-only"}>{state?.error ? t(state.error as MessageKey) : ""}</p>
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-hairline bg-surface">
        <div className="mx-auto max-w-[560px] px-4 py-3"><Button disabled={pending}>{pending ? t("quote.pay.processing") : t("quote.accept")}</Button></div>
      </div>
      <div className="h-20" aria-hidden="true" />
    </form>
  );
}
