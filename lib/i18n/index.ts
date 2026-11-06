import { cookies } from "next/headers";
import { isLocale, makeT, type Locale, type T } from "./make-t";

export * from "./make-t";
export const LOCALE_COOKIE = "lang";

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : "en";
}
export async function getT(): Promise<{ t: T; locale: Locale }> {
  const locale = await getLocale();
  return { t: makeT(locale), locale };
}
