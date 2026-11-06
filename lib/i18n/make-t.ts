import { auth } from "./messages/auth";
import { bill } from "./messages/bill";
import { common } from "./messages/common";
import { lead } from "./messages/lead";
import { quote } from "./messages/quote";
import { sales } from "./messages/sales";
import { status } from "./messages/status";

export const LOCALES = ["en", "mr", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_LABEL: Record<Locale, string> = { en: "English", mr: "मराठी", hi: "हिन्दी" };

const parts = [common, auth, lead, bill, quote, status, sales];
// Scoped groups must be complete in MR/HI (enforced by tests/i18n.test.ts); sales.* may fall back to English.
export const dictionary: Record<Locale, Record<string, string>> = {
  en: Object.assign({}, ...parts.map((p) => p.en)),
  mr: Object.assign({}, ...parts.map((p) => p.mr)),
  hi: Object.assign({}, ...parts.map((p) => p.hi)),
};
export type MessageKey = keyof typeof common.en | keyof typeof auth.en | keyof typeof lead.en | keyof typeof bill.en | keyof typeof quote.en | keyof typeof status.en | keyof typeof sales.en;

export type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function makeT(locale: Locale): T {
  return (key, vars) => {
    const raw = dictionary[locale][key] ?? dictionary.en[key] ?? key;
    return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? "")) : raw;
  };
}

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);


/** Plain-object subset of messages (by key prefix) that can be passed to client components. */
export function messagesFor(locale: Locale, prefixes: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, en] of Object.entries(dictionary.en)) {
    if (prefixes.some((p) => k.startsWith(p))) out[k] = dictionary[locale][k] ?? en;
  }
  return out;
}

/** Client-side translator over a messages object from messagesFor. */
export function tFrom(messages: Record<string, string>): T {
  return (key, vars) => {
    const raw = messages[key] ?? key;
    return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? "")) : raw;
  };
}
