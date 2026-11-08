"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { CheckIcon } from "@/components/icons";
import { PanelBack, PanelHead } from "@/components/shared/panel-form";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { Person } from "@/lib/bill";
import { parseMoney, toAutoPointInput, toInputValue } from "@/lib/money";
import type { ScanLine } from "@/lib/receipt-scan";
import { avatarColor, cn } from "@/lib/utils";

export function Dot({ color, className }: { color: number; className?: string }) {
  const c = avatarColor(color);
  return (
    <i
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full bg-(--dot) dark:bg-(--dot-dark)", className)}
      style={{ "--dot": c.fg, "--dot-dark": c.dark } as CSSProperties}
    />
  );
}

export function PickRow({
  checked,
  many = false,
  lead,
  label,
  sub,
  onClick,
}: {
  checked: boolean;
  many?: boolean;
  lead: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={many ? "checkbox" : "radio"}
      aria-checked={checked}
      onClick={onClick}
      className="grid min-h-[54px] w-full grid-cols-[32px_minmax(0,1fr)_24px] items-center gap-x-3 border-t border-line px-1 py-2 text-left first:border-t-0 hover:bg-chip"
    >
      {lead}
      <span className="text-[15px] leading-[1.3] font-bold [overflow-wrap:anywhere]">
        {label}
        {sub ? <small className="block text-[12px] font-semibold text-faint tabular">{sub}</small> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "grid size-6 place-items-center",
          many ? "rounded-[7px]" : "rounded-full",
          checked ? "bg-green text-white" : "text-transparent ring-2 ring-dash ring-inset",
        )}
      >
        <CheckIcon size={14} />
      </span>
    </button>
  );
}

function toTop(el: HTMLElement | null) {
  for (let box = el?.parentElement; box; box = box.parentElement) {
    if (box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY)) {
      box.scrollTop = 0;
      return;
    }
  }
  if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
}

export function WhoHadIt({
  line,
  index,
  count,
  people,
  sharing,
  bare,
  onPick,
  onPrice,
  onSkip,
  onBack,
  onClose,
}: {
  line: ScanLine & { who: string[] };
  index: number;
  count: number;
  people: Person[];
  sharing: string[];
  bare: boolean;
  onPick: (who: string[]) => void;
  onPrice: (amountMinor: number) => void;
  onSkip: () => void;
  onBack: () => void;
  onClose?: () => void;
}) {
  const { t, money, plain } = useI18n();
  const desktop = useIsDesktop();
  const [many, setMany] = useState(line.who.length > 1);
  const [chosen, setChosen] = useState(line.who);
  const [fixing, setFixing] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => toTop(root.current), []);

  const ids = people.map((p) => p.id);
  const last = index + 1 === count;
  const sharers = people.filter((p) => sharing.includes(p.id));
  const sharedLabel =
    sharers.length === people.length
      ? t.bill.everyoneShares
      : sharers.length === 1
        ? sharers[0].name
        : fmt(t.bill.sharedCount, { count: sharers.length });
  const each =
    line.amountMinor > 0 && sharers.length > 1
      ? fmt(t.bill.lineEach, { amount: plain(Math.round(line.amountMinor / sharers.length)) })
      : undefined;
  const toggle = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : ids.filter((x) => x === id || c.includes(x))));
  const link = "h-8 shrink-0 text-left text-[13px] font-bold";

  return (
    <div
      ref={root}
      className={cn(
        "flex scroll-mt-16 flex-col",
        bare ? "gap-3" : "gap-3 rounded-2xl border border-border bg-card p-4",
      )}
    >
      <PanelBack.Provider value={onBack}>
        <PanelHead title={t.bill.whoHadIt} sub={fmt(t.bill.itemOf, { n: index + 1, count })} onClose={onClose} />
      </PanelBack.Provider>

      <div className="flex animate-rise flex-col gap-1 rounded-xl bg-chip px-3.5 pt-3 pb-2">
        <b className="text-[17px] leading-[1.3] font-extrabold tracking-[-0.01em] [overflow-wrap:anywhere]">
          {line.name}
        </b>
        <div className="flex min-h-10 items-center justify-between gap-3">
          {fixing ? (
            <>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                aria-label={fmt(t.bill.amountOf, { name: line.name })}
                value={toInputValue(line.amountMinor, "MYR")}
                onChange={(e) => onPrice(parseMoney(toAutoPointInput(e.target.value, "MYR"), "MYR") ?? 0)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setFixing(false);
                }}
                className="h-[38px] w-[120px] rounded-[10px] border-[1.5px] border-green bg-card px-2.5 text-right text-[16px] font-extrabold text-ink tabular shadow-[0_0_0_3px_var(--green-soft)] outline-none"
              />
              <button type="button" onClick={() => setFixing(false)} className={cn(link, "text-green-ink")}>
                {t.bill.done}
              </button>
            </>
          ) : (
            <>
              <span className="text-[15px] font-bold text-muted tabular">{money(line.amountMinor)}</span>
              <button type="button" onClick={() => setFixing(true)} className={cn(link, "text-green-ink")}>
                {t.bill.fixPrice}
              </button>
            </>
          )}
        </div>
      </div>

      <div role={many ? "group" : "radiogroup"} aria-label={line.name} className="flex flex-col">
        {many ? null : (
          <PickRow
            checked={line.who.length === 0}
            lead={
              <span aria-hidden className="flex w-8 justify-center">
                {sharers.slice(0, 3).map((p, k) => (
                  <Dot key={p.id} color={p.color} className={cn("size-3.5 ring-2 ring-card", k > 0 && "-ml-1.5")} />
                ))}
              </span>
            }
            label={sharedLabel}
            sub={each}
            onClick={() => onPick([])}
          />
        )}
        {people.map((p) => (
          <PickRow
            key={p.id}
            many={many}
            checked={many ? chosen.includes(p.id) : line.who.length === 1 && line.who[0] === p.id}
            lead={<Avatar name={p.name} color={p.color} size={32} />}
            label={p.name}
            onClick={() => (many ? toggle(p.id) : onPick([p.id]))}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setMany(!many);
            setChosen(line.who);
          }}
          className={cn(link, many ? "text-muted" : "text-green-ink")}
        >
          {many ? t.bill.justOne : t.bill.moreThanOne}
        </button>
        {!many && !last ? (
          <button type="button" onClick={onSkip} className={cn(link, "text-muted")}>
            {t.bill.skip} ›
          </button>
        ) : null}
      </div>

      {many ? (
        <div className={cn("sticky bottom-0 z-10 bg-card pt-1 pb-1", !desktop && "-mx-4 px-4")}>
          <button
            type="button"
            disabled={chosen.length === 0}
            onClick={() => onPick(chosen.length === ids.length && sharers.length === ids.length ? [] : chosen)}
            className="h-12 w-full rounded-xl bg-green text-[15px] font-bold text-white disabled:bg-disabled disabled:text-disabled-ink"
          >
            {last ? t.bill.done : `${t.bill.nextItem} ›`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
