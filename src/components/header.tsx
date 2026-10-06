"use client";

import { useTheme } from "next-themes";
import Link from "next/link";
import { Fragment, useTransition, type ReactNode } from "react";
import { setLocale } from "@/app/actions";
import type { Locale } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { useHydrated } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HelpButton } from "./help/how-to";
import { BackIcon, MoonIcon, SunIcon } from "./icons";

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
              className={cn(
                "h-9 px-2 transition-colors",
                active ? "font-extrabold text-ink" : "font-semibold text-faint hover:text-ink",
              )}
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
 * Pinned to the top of the window. It is `fixed`, not `sticky`, so the iPhone's rubber-band
 * bounce (dragging past the top of the page) cannot pull it down with the content.
 * It copies its page column's width, side padding and background (`inherit`), so the logo and
 * controls line up with the content; the hairline bar behind it spans the whole window.
 * A spacer keeps the page content below it.
 */
export function Header({ theme = true }: { theme?: boolean }) {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 mx-auto flex h-14 max-w-[inherit] items-center justify-between bg-inherit px-[inherit] md:h-16">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-14 border-b border-line bg-inherit md:h-16"
        />
        <Logo />
        {/* no boxes around the controls; -mr-2 lines the last icon up with the page edge */}
        <div className="-mr-2 flex items-center gap-0.5">
          {theme ? <HelpButton /> : null}
          <LanguageToggle />
          {theme ? <ThemeToggle /> : null}
        </div>
      </header>
      <div aria-hidden className="h-16 shrink-0 md:h-20" />
    </>
  );
}

/**
 * The fixed top bar of a sub-page (the receipt): back on the left, the page name in the middle and
 * an optional action on the right. Pinned and sized like `Header`, with the same spacer below.
 */
export function TopBar({
  back,
  title,
  action,
}: {
  back: { label: string; href?: string; onClick?: () => void };
  title: string;
  action?: ReactNode;
}) {
  const backClass =
    "-ml-1.5 flex h-10 items-center gap-1 justify-self-start pr-2 text-[15px] font-bold text-ink no-underline";
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 mx-auto grid h-14 max-w-[inherit] grid-cols-[1fr_auto_1fr] items-center bg-inherit px-[inherit] md:h-16">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-14 border-b border-line bg-inherit md:h-16"
        />
        {back.href ? (
          <Link href={back.href} className={backClass}>
            <BackIcon />
            {back.label}
          </Link>
        ) : (
          <button type="button" onClick={back.onClick} className={backClass}>
            <BackIcon />
            {back.label}
          </button>
        )}
        <h1 className="m-0 text-[16px] font-extrabold">{title}</h1>
        <div className="flex justify-self-end">{action}</div>
      </header>
      <div aria-hidden className="h-16 shrink-0 md:h-20" />
    </>
  );
}
