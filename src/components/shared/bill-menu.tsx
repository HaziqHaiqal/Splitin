"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { SheetHead } from "@/components/sheet";
import { useKeyboardViewport } from "@/hooks/use-keyboard-viewport";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { InMenuCard } from "./panel-form";

export type Tile = {
  key: string;
  icon: ReactNode;
  label: string;
  sub?: string;
  dot?: boolean;
  next?: boolean;
  checked?: boolean;
  onClick: () => void;
};

export function MenuRow({ tile }: { tile: Tile }) {
  const toggle = tile.checked !== undefined;
  return (
    <button
      type="button"
      role={toggle ? "switch" : undefined}
      aria-checked={toggle ? tile.checked : undefined}
      onClick={tile.onClick}
      className="flex min-h-12 w-full items-center gap-3 px-2.5 py-1.5 text-left text-ink hover:bg-chip"
    >
      <span className="relative shrink-0 text-muted">
        {tile.icon}
        {tile.dot ? (
          <i
            aria-hidden
            className="absolute -top-0.5 -right-1 size-[9px] rounded-full bg-green shadow-[0_0_0_2px_var(--card)]"
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[14.5px] font-semibold">{tile.label}</b>
        {tile.sub ? <small className="block truncate text-[12px] font-semibold text-muted">{tile.sub}</small> : null}
      </span>
      {toggle ? (
        <span
          aria-hidden
          className={cn(
            "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors",
            tile.checked ? "bg-green" : "bg-track",
          )}
        >
          <i
            className={cn(
              "absolute top-[3px] left-[3px] size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform",
              tile.checked && "translate-x-[18px]",
            )}
          />
        </span>
      ) : (tile.next ?? Boolean(tile.sub)) ? (
        <span aria-hidden className="text-[16px] text-faint">
          ›
        </span>
      ) : null}
    </button>
  );
}

export function IconTile({ tile, ring = "var(--card)" }: { tile: Tile; ring?: string }) {
  return (
    <button
      type="button"
      onClick={tile.onClick}
      className="group flex flex-col items-center gap-1.5 text-center text-[11.5px] leading-[1.2] font-bold text-ink"
    >
      <span className="relative grid size-[50px] place-items-center rounded-full bg-chip transition-transform duration-150 group-hover:scale-106">
        {tile.icon}
        {tile.dot ? (
          <i
            aria-hidden
            className="absolute top-px right-px size-[11px] rounded-full bg-green"
            style={{ boxShadow: `0 0 0 2px ${ring}` }}
          />
        ) : null}
      </span>
      {tile.label}
    </button>
  );
}

const spring = "transition-[rotate,scale,opacity] duration-[280ms] ease-[cubic-bezier(0.3,1.4,0.5,1)]";

export function MenuFab({ open, dot, onClick }: { open: boolean; dot: boolean; onClick: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--toast-lift", "62px");
    return () => {
      root.style.removeProperty("--toast-lift");
    };
  }, []);

  return (
    <button
      type="button"
      data-menu-button
      aria-label={open ? t.page.closeMenu : t.page.menu}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onClick}
      className={cn(
        "fixed right-[max(16px,env(safe-area-inset-right))] bottom-[max(16px,env(safe-area-inset-bottom))] z-40 grid size-[46px] place-items-center rounded-full bg-ink text-bg shadow-[0_5px_14px_var(--pop-shadow)] transition-colors",
        open && "shadow-none",
      )}
    >
      <MenuIcon size={20} className={cn("[grid-area:1/1]", spring, open && "scale-50 rotate-90 opacity-0")} />
      <CloseIcon
        size={16}
        strokeWidth={2.6}
        className={cn("[grid-area:1/1]", spring, !open && "scale-50 -rotate-90 opacity-0")}
      />
      {dot && !open ? (
        <i
          aria-hidden
          className="absolute top-0 right-0 size-[11px] rounded-full bg-green shadow-[0_0_0_2px_var(--tray)]"
        />
      ) : null}
    </button>
  );
}

const corner = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Cpath d='M0 0H72A12 12 0 0 1 60 12H41A29 29 0 0 0 12 41V60A12 12 0 0 1 0 72Z'/%3E%3C/svg%3E")`;
const notch: CSSProperties = {
  mask: `${corner} right bottom / 72px 72px no-repeat, linear-gradient(#000 0 0) left top / 100% calc(100% - 71px) no-repeat, linear-gradient(#000 0 0) left bottom / calc(100% - 71px) 72px no-repeat`,
};

export function MenuCard({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  const card = useRef<HTMLDivElement>(null);
  const keyboard = useKeyboardViewport(card);
  const close = useRef(onClose);

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    card.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close.current();
      document.querySelector<HTMLButtonElement>("[data-menu-button]")?.focus();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);

  return (
    <>
      <div aria-hidden onClick={onClose} className="fixed inset-0 z-30 animate-fade bg-overlay" />
      <div
        style={keyboard ? { top: keyboard.bottom - 8, bottom: "auto", transform: "translateY(-100%)" } : undefined}
        className="fixed right-[calc(max(16px,env(safe-area-inset-right))-8px)] bottom-[calc(max(16px,env(safe-area-inset-bottom))-8px)] z-40 w-[calc(100vw-16px)] max-w-[424px]"
      >
        <div className="origin-[calc(100%-31px)_calc(100%-31px)] animate-grow drop-shadow-[0_14px_34px_var(--pop-shadow)]">
          <div
            ref={card}
            role="dialog"
            aria-modal="true"
            aria-label={t.page.menu}
            tabIndex={-1}
            style={keyboard ? { ...notch, maxHeight: keyboard.height - 16 } : notch}
            className="max-h-[calc(100dvh-100px)] overflow-y-auto overscroll-contain rounded-[20px] border border-border bg-card p-2 text-ink outline-none"
          >
            <InMenuCard.Provider value={true}>{children}</InMenuCard.Provider>
          </div>
        </div>
      </div>
    </>
  );
}

export function Rise({ children, className }: { children: ReactNode[]; className?: string }) {
  return (
    <div className={className}>
      {children.map((child, i) =>
        child ? (
          <div key={i} className="animate-rise" style={{ animationDelay: `${Math.min(i, 7) * 25}ms` } as CSSProperties}>
            {child}
          </div>
        ) : null,
      )}
    </div>
  );
}

export function MenuHead({ title, sub, onBack }: { title: string; sub?: string; onBack?: () => void }) {
  return (
    <div className="sticky -top-2 z-10 -mx-2 -mt-2 mb-1 bg-card px-4 pt-3 pb-2">
      <SheetHead title={title} sub={sub} onBack={onBack} />
    </div>
  );
}

export function MenuItem({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-2.5 rounded-[11px] px-2.5 text-left text-[14px] font-semibold text-ink hover:bg-chip focus-visible:bg-chip"
    >
      <span className="shrink-0 text-muted">{icon}</span>
      {label}
    </button>
  );
}
