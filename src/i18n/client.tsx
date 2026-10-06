"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { getDictionary, intlLocale, type Dictionary, type Locale } from "./index";

type I18n = {
  locale: Locale;
  t: Dictionary;
  money: (minor: number) => string;
  plain: (minor: number) => string;
  date: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  time: (iso: string) => string;
  monthName: (offset?: number) => string;
};

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18n>(() => {
    const plainFormat = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return {
      locale,
      t: getDictionary(locale),
      money: (minor) => `RM ${plainFormat.format(minor / 100)}`,
      plain: (minor) => plainFormat.format(minor / 100),
      date: (iso, opts) => new Intl.DateTimeFormat(intlLocale(locale), opts).format(new Date(iso)),
      time: (iso) =>
        new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)),
      monthName: (offset = 0) => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() + offset);
        return new Intl.DateTimeFormat(intlLocale(locale), { month: "long" }).format(d);
      },
    };
  }, [locale]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
