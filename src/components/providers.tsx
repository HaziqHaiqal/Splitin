"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { I18nProvider } from "@/i18n/client";
import type { Locale } from "@/i18n";
import { ToastProvider } from "./toast";

/** The page colour of each theme, for the phone's address bar. */
const BAR = { light: "#fbfbfa", dark: "#0e131b" };

/** Keeps the phone's address bar the same colour as the page when the theme changes. */
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
