"use client";

import { useTheme } from "next-themes";
import Link from "next/link";
import { Fragment, useTransition } from "react";
import { setLocale } from "@/app/actions";
import type { Locale } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { useHydrated } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HelpButton } from "./help/how-to";
import { MoonIcon, SunIcon } from "./icons";

export function Logo() {
  return (
    <Link href="/" className="text-[21px] font-extrabold tracking-[-0.03em] text-ink no-underline">
      split<span className="text-green-ink">in</span>
    </Link>
  );
}

const LANGUAGES: { code: Locale; label: string; name: string }[] = [
  { code: "en", label: "EN", name: "English" },
  { code: "ms", label: "BM", name: "Bahasa Melayu" },
];

/** Plain "EN | BM": the language in use is dark, the other one is grey until tapped. */
export function LanguageToggle() {
  const { locale } = useI18n();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label="Language" className={cn("flex items-center text-[13px]", pending && "opacity-60")}>
      {LANGUAGES.map((l, i) => {
        const active = l.code === locale;
        return (
          <Fragment key={l.code}>
            {i > 0 ? <span aria-hidden className="h-3 w-px bg-dash" /> : null}
            <button
              type="button"
              title={l.name}
              aria-pressed={active}
              disabled={pending}
              onClick={() => {
                if (!active) start(() => setLocale(l.code));
              }}
              className={cn("h-9 px-2 transition-colors", active ? "font-extrabold text-ink" : "font-semibold text-faint hover:text-ink")}
            >
              {l.label}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

/** One quiet icon: the moon switches to dark, the sun switches back to light. */
export function ThemeToggle() {
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const dark = hydrated && resolvedTheme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={t.common.darkMode}
      title={dark ? t.common.lightMode : t.common.darkMode}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-chip hover:text-ink"
    >
      {/* picked by CSS, so the right icon shows before the page finishes loading */}
      <SunIcon size={19} className="hidden dark:block" />
      <MoonIcon size={19} className="dark:hidden" />
    </button>
  );
}

/**
 * Stays at the top of the window while the page scrolls. It lives inside the page's own column, so
 * the logo and controls line up with the content; the bar behind it spans the whole window.
 * The page container must set a background and have no top padding.
 */
export function Header({ theme = true }: { theme?: boolean }) {
  return (
    <header className="sticky top-0 z-30 mb-2 flex h-14 shrink-0 items-center justify-between bg-inherit md:mb-4 md:h-16">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-14 border-b border-line bg-inherit md:h-16" />
      <Logo />
      {/* no boxes around the controls; -mr-2 lines the last icon up with the page edge */}
      <div className="-mr-2 flex items-center gap-0.5">
        {theme ? <HelpButton /> : null}
        <LanguageToggle />
        {theme ? <ThemeToggle /> : null}
      </div>
    </header>
  );
}
