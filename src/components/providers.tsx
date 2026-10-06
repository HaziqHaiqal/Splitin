"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n/client";
import type { Locale } from "@/i18n";
import { ToastProvider } from "./toast";

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      storageKey="splitin-theme"
      enableSystem={false}
      disableTransitionOnChange
    >
      <I18nProvider locale={locale}>
        <ToastProvider>{children}</ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
