"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { BackIcon, CheckIcon, CloseIcon, DotsIcon } from "@/components/icons";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export type Tile = { key: string; icon: ReactNode; label: string; dot?: boolean; onClick: () => void };

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
      )}
    >
      <DotsIcon size={20} className={cn("[grid-area:1/1]", spring, open && "scale-50 rotate-90 opacity-0")} />
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

export function MenuCard({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  const card = useRef<HTMLDivElement>(null);
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
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label={t.page.menu}
        tabIndex={-1}
        className="fixed right-3 bottom-[calc(max(16px,env(safe-area-inset-bottom))+56px)] z-40 max-h-[calc(100dvh-150px)] w-[calc(100vw-24px)] max-w-[420px] origin-[calc(100%-27px)_calc(100%+33px)] animate-grow overflow-y-auto overscroll-contain rounded-[20px] border border-border bg-card p-2 text-ink shadow-[0_14px_34px_var(--pop-shadow)] outline-none"
      >
        {children}
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
  const { t } = useI18n();
  return (
    <div className={cn("mb-1 flex items-start gap-1 border-b border-line pt-[7px] pb-[9px]", onBack ? "pr-2.5" : "px-2.5")}>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={t.page.back}
          className="-my-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink hover:bg-chip"
        >
          <BackIcon size={17} strokeWidth={2.4} />
        </button>
      ) : null}
      <span className="min-w-0 text-[12.5px] leading-[1.4] font-semibold text-muted">
        <b className="block text-[14px] font-extrabold text-ink">{title}</b>
        {sub ? <small className="mt-0.5 block text-[12px] font-medium">{sub}</small> : null}
      </span>
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

export function Tick({
  on,
  label,
  dim = false,
  onClick,
}: {
  on: boolean;
  label: string;
  dim?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-disabled={dim || undefined}
      aria-label={label}
      onClick={onClick}
      className={cn("-mr-2.5 inline-flex size-11 shrink-0 items-center justify-center", dim && "opacity-50")}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex size-[26px] items-center justify-center rounded-full transition-colors duration-200",
          on ? "bg-green text-white" : "border-2 border-dash",
        )}
      >
        {on ? <CheckIcon size={15} className="animate-pop" /> : null}
      </span>
    </button>
  );
}
