"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { I18nProvider } from "@/i18n/client";
import type { Locale } from "@/i18n";
import { ToastProvider } from "./toast";

const BAR = { light: "#fbfbfa", dark: "#0e131b" };

function ThemeColor() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR[resolvedTheme]);
  }, [resolvedTheme]);
  return null;
}

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      storageKey="splitin-theme"
      enableSystem={false}
      disableTransitionOnChange
    >
      <ThemeColor />
      <I18nProvider locale={locale}>
        <ToastProvider>{children}</ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
