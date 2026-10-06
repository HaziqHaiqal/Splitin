"use client";

import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { setLocale } from "@/app/actions";
import type { Locale } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { useHydrated } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HelpButton } from "./help/how-to";
import { BackIcon, CheckIcon, ChevronDownIcon, MoonIcon, SunIcon } from "./icons";

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

export function LanguageToggle() {
  const { locale } = useI18n();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Language: ${current.name}`}
        disabled={pending}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 items-center gap-1 rounded-full pr-2 pl-2.5 text-[13px] font-extrabold text-ink transition-colors hover:bg-chip",
          (open || pending) && "bg-chip",
          pending && "opacity-60",
        )}
      >
        {current.label}
        <ChevronDownIcon className={cn("text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Language"
          className="absolute top-full right-0 z-40 mt-1.5 min-w-[184px] rounded-2xl border border-border bg-sheet p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.25)]"
        >
          {LANGUAGES.map((l) => {
            const active = l.code === locale;
            return (
              <button
                key={l.code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setOpen(false);
                  if (!active) start(() => setLocale(l.code));
                }}
                className="flex h-10 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-[14px] font-semibold text-ink transition-colors hover:bg-chip"
              >
                {l.name}
                {active ? <CheckIcon size={15} className="text-green-ink" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

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
      <SunIcon size={19} className="hidden dark:block" />
      <MoonIcon size={19} className="dark:hidden" />
    </button>
  );
}

export function Header() {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 mx-auto flex h-14 max-w-[inherit] items-center justify-between bg-inherit px-[inherit] md:h-16">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-14 border-b border-line bg-inherit md:h-16"
        />
        <Logo />
        <div className="-mr-2 flex items-center gap-0.5">
          <HelpButton />
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <div aria-hidden className="h-16 shrink-0 md:h-20" />
    </>
  );
}

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
      <header className="fixed inset-x-0 top-0 z-30 mx-auto grid h-14 max-w-[inherit] grid-cols-[1fr_auto_1fr] items-center gap-2 bg-inherit px-[inherit] md:h-16">
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
        <h1 className="m-0 truncate text-center text-[16px] font-extrabold">{title}</h1>
        <div className="-mr-2 flex items-center justify-self-end">{action}</div>
      </header>
      <div aria-hidden className="h-16 shrink-0 md:h-20" />
    </>
  );
}
