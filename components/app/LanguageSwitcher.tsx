"use client";
import { usePathname } from "next/navigation";
import { setLocaleAction } from "@/app/actions/auth";
import { LOCALES, LOCALE_LABEL, type Locale } from "@/lib/i18n/make-t";

export function LanguageSwitcher({ current }: { current: Locale }) {
  const back = usePathname();
  return (
    <form action={setLocaleAction} className="flex gap-1" aria-label="Language">
      <input type="hidden" name="back" value={back} />
      {LOCALES.map((l) => (
        <button key={l} name="lang" value={l} lang={l} aria-current={l === current ? "true" : undefined}
          className={`min-h-12 min-w-10 whitespace-nowrap rounded-md px-1.5 text-sm ${l === current ? "font-bold underline underline-offset-4" : "text-muted"}`}>
          {LOCALE_LABEL[l]}
        </button>
      ))}
    </form>
  );
}
