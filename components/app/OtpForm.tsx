"use client";
import { useActionState, useRef } from "react";
import { authAction, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { tFrom } from "@/lib/i18n/make-t";
import type { T } from "@/lib/i18n/make-t";

export function OtpForm({ messages, demo, demoOtp }: { messages: Record<string, string>; demo: boolean; demoOtp: string }) {
  const t = tFrom(messages);
  const [state, action, pending] = useActionState<AuthState, FormData>(authAction, { step: "phone" });
  if (state.step === "code") {
    return <CodeStep t={t} state={state} action={action} pending={pending} demo={demo} demoOtp={demoOtp} />;
  }
  return (
    <form action={action} noValidate>
      <input type="hidden" name="intent" value="request" />
      <p className="mb-6 text-muted">{t("auth.intro")}</p>
      <Field id="phone" label={t("auth.phone")} hint={t("auth.phoneHint")} error={state.error ? t(state.error) : null}>
        <TextInput id="phone" type="tel" inputMode="numeric" autoComplete="tel" hint maxLength={20} required />
      </Field>
      {demo ? <p className="mb-6 border-l-2 border-hairline pl-3 text-sm text-muted">{t("auth.demoHint", { code: demoOtp })}</p> : null}
      <Button disabled={pending}>{pending ? t("auth.sending") : t("auth.sendCode")}</Button>
    </form>
  );
}

function CodeStep({ t, state, action, pending, demo, demoOtp }: {
  t: T; state: Extract<AuthState, { step: "code" }>; action: (f: FormData) => void; pending: boolean; demo: boolean; demoOtp: string;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const hidden = useRef<HTMLInputElement>(null);
  const sync = () => {
    if (hidden.current) hidden.current.value = boxes.current.map((b) => b?.value ?? "").join("");
  };
  const onInput = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "");
    if (v.length > 1) {
      // paste or SMS autofill: spread across boxes (Jakob: behaves like every OTP screen)
      v.slice(0, 6).split("").forEach((ch, k) => { const b = boxes.current[k]; if (b) b.value = ch; });
      boxes.current[Math.min(v.length, 5)]?.focus();
    } else {
      e.target.value = v;
      if (v && i < 5) boxes.current[i + 1]?.focus();
    }
    sync();
  };
  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !e.currentTarget.value && i > 0) boxes.current[i - 1]?.focus();
  };
  return (
    <form action={action} noValidate>
      <h2 className="display mb-2 text-2xl">{t("auth.codeTitle")}</h2>
      <p className="mb-6 text-muted">{t("auth.codeIntro", { phone: state.phone })}</p>
      <input type="hidden" name="intent" value="verify" />
      <input type="hidden" name="phone" value={state.phone} />
      <input type="hidden" name="code" ref={hidden} />
      <fieldset className="mb-2">
        <legend className="sr-only">{t("auth.codeTitle")}</legend>
        <div className="flex gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <input
              key={i}
              ref={(el) => { boxes.current[i] = el; }}
              aria-label={`${i + 1} / 6`}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={6}
              onChange={(e) => onInput(i, e)}
              onKeyDown={(e) => onKey(i, e)}
              className="num min-h-14 w-full min-w-0 rounded-md border border-ink/40 bg-surface text-center text-2xl"
            />
          ))}
        </div>
      </fieldset>
      <p role="alert" className={state.error ? "mb-4 text-sm font-semibold text-warn" : "sr-only"}>{state.error ? t(state.error) : ""}</p>
      {demo ? <p className="mb-6 border-l-2 border-hairline pl-3 text-sm text-muted">{t("auth.demoHint", { code: state.demoCode ?? demoOtp })}</p> : null}
      <Button disabled={pending}>{pending ? t("auth.verifying") : t("auth.verify")}</Button>
      <div className="mt-4"><a href="/signin" className="inline-flex min-h-12 items-center underline underline-offset-4">{t("auth.changeNumber")}</a></div>
    </form>
  );
}
