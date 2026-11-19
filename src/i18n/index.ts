import { en, type Dictionary } from "./en";
import { ms } from "./ms";
import { ta } from "./ta";
import { zh } from "./zh";

export type Locale = "en" | "ms" | "zh" | "ta";
export type { Dictionary };

export const LOCALE_COOKIE = "splitin-locale";

const dictionaries: Record<Locale, Dictionary> = { en, ms, zh, ta };
const intlLocales: Record<Locale, string> = { en: "en-MY", ms: "ms-MY", zh: "zh-Hans-MY", ta: "ta-MY" };
const htmlLangs: Record<Locale, string> = { en: "en", ms: "ms", zh: "zh-Hans", ta: "ta" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(dictionaries, value);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function intlLocale(locale: Locale) {
  return intlLocales[locale];
}

export function htmlLang(locale: Locale) {
  return htmlLangs[locale];
}

export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}
