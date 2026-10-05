import { en, type Dictionary } from "./en";
import { ms } from "./ms";

export type Locale = "en" | "ms";
export type { Dictionary };

export const LOCALE_COOKIE = "splitin-locale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ms";
}

export function getDictionary(locale: Locale): Dictionary {
  return locale === "ms" ? ms : en;
}

export function intlLocale(locale: Locale) {
  return locale === "ms" ? "ms-MY" : "en-MY";
}

/** Replace `{name}` placeholders. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}
