import "server-only";
import { cookies } from "next/headers";
import { getDictionary, isLocale, LOCALE_COOKIE, type Locale } from "./index";

/** English unless the visitor picked BM with the header switch. */
export async function getLocale(): Promise<Locale> {
  const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(cookieValue) ? cookieValue : "en";
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}
