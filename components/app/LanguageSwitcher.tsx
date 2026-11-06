import { setLocaleAction } from "@/app/actions/auth";
import { LOCALES, LOCALE_LABEL, type Locale } from "@/lib/i18n/make-t";

export function LanguageSwitcher({ current, back }: { current: Locale; back: string }) {
  return (
    <form action={setLocaleAction} className="flex gap-1" aria-label="Language">
      <input type="hidden" name="back" value={back} />
      {LOCALES.map((l) => (
        <button
          key={l}
          name="lang"
          value={l}
          lang={l}
          aria-current={l === current ? "true" : undefined}
          className={`min-h-12 min-w-12 rounded-md px-2 text-sm ${l === current ? "font-bold underline underline-offset-4" : "text-muted"}`}
        >
          {LOCALE_LABEL[l]}
        </button>
      ))}
    </form>
  );
}
