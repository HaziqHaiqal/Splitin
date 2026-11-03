"use client";

import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { setLocale } from "@/app/actions";
import type { Locale } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { useHydrated } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useGuide } from "./help/how-to";
import { BackIcon, HelpIcon, MoonIcon, SettingsIcon, SunIcon } from "./icons";

export function Logo() {
  return (
    <Link href="/" className="text-[21px] font-extrabold tracking-[-0.03em] text-ink no-underline">
      split<span className="text-green-ink">in</span>
    </Link>
  );
}

const LANGUAGES: { code: Locale; name: string }[] = [
  { code: "en", name: "English" },
  { code: "ms", name: "Bahasa Melayu" },
];

const LOOKS = [
  { value: "light", icon: <SunIcon size={15} /> },
  { value: "dark", icon: <MoonIcon size={14} /> },
  { value: "system", icon: null },
] as const;

function Segments({
  label,
  options,
}: {
  label: string;
  options: { key: string; text: ReactNode; on: boolean; pick: () => void }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-0.5 text-[12px] font-bold text-muted">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-xl bg-chip p-[3px]"
      >
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={o.on}
            onClick={o.pick}
            className={cn(
              "flex h-[34px] items-center justify-center gap-1.5 rounded-[9px] px-1.5 text-[13px] font-bold transition-colors",
              o.on ? "bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-muted hover:text-ink",
            )}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsMenu() {
  const { t, locale } = useI18n();
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const guide = useGuide();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const looks = { light: t.common.light, dark: t.common.dark, system: t.common.auto };

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
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t.common.settings}
        title={t.common.settings}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-chip hover:text-ink",
          open && "bg-chip text-ink",
        )}
      >
        <SettingsIcon className={cn("transition-transform duration-300", open && "rotate-45")} />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t.common.settings}
          className="absolute top-full right-0 z-40 mt-1.5 flex w-[264px] animate-rise flex-col gap-3.5 rounded-2xl border border-border bg-sheet p-3 shadow-[0_12px_32px_rgba(0,0,0,0.25)]"
        >
          <Segments
            label={t.common.language}
            options={LANGUAGES.map((l) => ({
              key: l.code,
              text: l.name,
              on: l.code === locale,
              pick: () => {
                if (l.code !== locale && !pending) start(() => setLocale(l.code));
              },
            }))}
          />
          <Segments
            label={t.common.look}
            options={LOOKS.map((l) => ({
              key: l.value,
              text: (
                <>
                  {l.icon}
                  {looks[l.value]}
                </>
              ),
              on: hydrated && (theme ?? "light") === l.value,
              pick: () => setTheme(l.value),
            }))}
          />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              guide.show();
            }}
            className="-mx-1 -mb-1 flex h-11 items-center gap-2.5 rounded-xl border-t border-line px-2 text-left text-[14px] font-semibold text-ink hover:bg-chip"
          >
            <HelpIcon size={18} className="text-muted" />
            <span className="flex-1">{t.help.button}</span>
            <span aria-hidden className="text-faint">
              ›
            </span>
          </button>
        </div>
      ) : null}
      {guide.sheet}
    </div>
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
        <div className="-mr-2 flex items-center">
          <SettingsMenu />
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
