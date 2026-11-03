"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CloseIcon, PencilIcon, ResetIcon } from "@/components/icons";
import { fmt, intlLocale } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { itemShares, joinShare, type BillDoc, type Item } from "@/lib/bill";
import { parseMoney, toAutoPointInput, toInputValue } from "@/lib/money";
import { cn } from "@/lib/utils";
import { MenuHead, MenuItem } from "./bill-menu";

export type BillRules = {
  canPart: (item: Item) => boolean;
  canEdit: (item: Item) => boolean;
  dim: (item: Item) => boolean;
};

export function BillRows({
  doc,
  me,
  open,
  rules,
  onOpen,
  onToggle,
  onHover,
  detail,
}: {
  doc: BillDoc;
  me: string | null;
  open: string | null;
  rules: BillRules;
  onOpen: (id: string | null) => void;
  onToggle: (item: Item) => void;
  onHover?: (id: string | null) => void;
  detail?: (item: Item) => ReactNode;
}) {
  const { t, money } = useI18n();
  const list = useRef<HTMLDivElement>(null);
  const popover = Boolean(detail);
  const nameOf = (id: string) => doc.people.find((p) => p.id === id)?.name ?? "?";

  useEffect(() => {
    if (!popover || !open) return;
    const outside = (e: PointerEvent) => {
      const row = list.current?.querySelector(`[data-row="${open}"]`);
      if (!(e.target instanceof Node) || !row?.contains(e.target)) onOpen(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpen(null);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [popover, open, onOpen]);

  return (
    <div ref={list} className={cn("flex flex-col", !popover && "px-1 pb-0.5")}>
      {doc.items.map((item, i) => {
        const on = Boolean(me && item.participants.includes(me));
        const amount = me ? (on ? (itemShares(item)[me] ?? 0) : joinShare(item, me)) : undefined;
        const expanded = open === item.id;
        return (
          <div
            key={item.id}
            data-row={item.id}
            onMouseEnter={() => onHover?.(item.id)}
            onMouseLeave={() => onHover?.(null)}
            className={cn("relative flex items-center gap-3", i > 0 && "border-t border-line", expanded && "z-10")}
          >
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={popover ? expanded : undefined}
              onClick={() => onOpen(expanded ? null : item.id)}
              className={cn(
                "group my-0.5 flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] p-2 text-left transition-colors hover:bg-chip",
                popover && "-ml-2",
                expanded && "bg-chip",
              )}
            >
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[14.5px] font-bold">
                  {item.name}
                  <span
                    aria-hidden
                    className="ml-1.5 inline-block text-faint transition-transform duration-150 group-hover:translate-x-0.5"
                  >
                    ›
                  </span>
                </b>
                <small className="block truncate text-[12px] font-semibold text-muted">
                  {fmt(item.paidBy === me ? t.page.youPaid : t.page.paidBy, {
                    name: nameOf(item.paidBy),
                    amount: money(item.amountMinor),
                  })}
                </small>
              </span>
              {amount === undefined ? null : on ? (
                <span className="shrink-0 text-right">
                  <b className="block text-[14px] font-bold tabular">{money(amount ?? 0)}</b>
                  <small className="block text-[11.5px] font-semibold text-muted">{t.page.partLabel}</small>
                </span>
              ) : rules.dim(item) ? (
                <span className="shrink-0 text-[14px] font-bold text-faint tabular">
                  {amount === null ? "–" : money(amount)}
                </span>
              ) : null}
            </button>
            {me && !on && !rules.dim(item) ? (
              <button
                type="button"
                onClick={() => onToggle(item)}
                className="h-9 shrink-0 rounded-full bg-green-soft px-3.5 text-[13px] font-extrabold text-green-soft-ink tabular"
              >
                {amount === null || amount === undefined ? t.page.join : fmt(t.page.joinFor, { amount: money(amount) })}
              </button>
            ) : null}
            {popover && expanded ? (
              <div className="absolute inset-x-0 top-[calc(100%-6px)] z-10 animate-drop rounded-2xl border border-border bg-card p-1.5 shadow-[0_14px_34px_var(--pop-shadow)]">
                {detail?.(item)}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const autoPoint = (v: string) => toAutoPointInput(v, "MYR");

export function BillDetail({
  item,
  doc,
  me,
  rules,
  pending,
  onBack,
  note,
  onPart,
  onEdit,
  onLeave,
}: {
  item: Item;
  doc: BillDoc;
  me: string | null;
  rules: BillRules;
  pending: boolean;
  onBack?: () => void;
  note?: string;
  onPart: (item: Item, written: number | undefined) => void;
  onEdit: (item: Item) => void;
  onLeave: (item: Item) => void;
}) {
  const { t, money, locale } = useI18n();
  const share = me ? itemShares(item)[me] : undefined;
  const on = share !== undefined;
  const [value, setValue] = useState(on ? toInputValue(share, "MYR") : "");
  const input = useRef<HTMLInputElement>(null);
  const part = on && rules.canPart(item);
  const edit = rules.canEdit(item);
  const own = Boolean(me && item.overrides[me] !== undefined);

  useEffect(() => {
    if (part && !onBack) input.current?.select();
  }, [part, onBack]);

  const names = new Intl.ListFormat(intlLocale(locale), { type: "conjunction" }).format(
    item.participants.map((id) => (id === me ? t.page.you : (doc.people.find((p) => p.id === id)?.name ?? "?"))),
  );
  const paid = fmt(item.paidBy === me ? t.page.youPaid : t.page.paidBy, {
    name: doc.people.find((p) => p.id === item.paidBy)?.name ?? "?",
    amount: money(item.amountMinor),
  });

  const save = (e: FormEvent) => {
    e.preventDefault();
    const written = parseMoney(value, "MYR");
    if (written === null || written <= 0) return input.current?.focus();
    onPart(item, written === share && !own ? undefined : written);
  };

  return (
    <>
      <MenuHead title={item.name} sub={fmt(t.page.splitWith, { paid, names })} onBack={onBack} />
      {part ? (
        <>
          <div className="px-2.5 pt-1 text-[12.5px] font-semibold text-muted">{t.page.yourPart}</div>
          <form onSubmit={save} className="flex gap-1.5 p-1">
            <label className="flex h-[42px] min-w-0 flex-1 items-center gap-1.5 rounded-[11px] border border-border bg-bg px-2.5 font-bold focus-within:border-green-ink">
              <span className="text-[15px] text-muted">RM</span>
              <input
                ref={input}
                type="text"
                inputMode="numeric"
                value={value}
                aria-label={fmt(t.join.amountOf, { name: item.name })}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setValue(autoPoint(e.target.value))}
                className="min-w-0 flex-1 border-0 bg-transparent text-[16px] font-bold text-ink tabular outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="h-[42px] shrink-0 rounded-[11px] bg-green px-3.5 text-[14px] font-bold text-white disabled:opacity-60"
            >
              {t.common.save}
            </button>
          </form>
          {own ? (
            <MenuItem icon={<ResetIcon size={16} />} label={t.page.splitEqually} onClick={() => onPart(item, undefined)} />
          ) : null}
          <MenuItem
            icon={<CloseIcon size={16} />}
            label={fmt(t.page.leave, { name: item.name })}
            onClick={() => onLeave(item)}
          />
        </>
      ) : on ? (
        <>
          <div className="mx-1 mt-1 flex items-center justify-between rounded-xl bg-chip px-3 py-2.5">
            <span className="text-[13px] font-semibold text-muted">{t.page.yourPart}</span>
            <b className="text-[15px] font-extrabold tabular">{money(share ?? 0)}</b>
          </div>
          {note ? <p className="m-0 pt-2 pr-14 pb-1 pl-2.5 text-[12.5px] leading-[1.45] text-muted">{note}</p> : null}
        </>
      ) : null}
      {edit ? (
        <>
          {part ? <div className="mx-1.5 my-1 h-px bg-line" /> : null}
          <MenuItem icon={<PencilIcon size={16} />} label={t.page.editBill} onClick={() => onEdit(item)} />
        </>
      ) : null}
    </>
  );
}

export function NameBody({
  name,
  allowed,
  pending,
  onSave,
}: {
  name: string;
  allowed: boolean;
  pending: boolean;
  onSave: (name: string) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(name);
  if (!allowed) return null;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSave(value.trim());
      }}
      className="flex gap-1.5 p-1"
    >
      <input
        type="text"
        value={value}
        autoFocus
        maxLength={30}
        autoCapitalize="words"
        autoComplete="off"
        aria-label={t.page.nameTitle}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setValue(e.target.value)}
        className="h-[42px] min-w-0 flex-1 rounded-[11px] border border-border bg-bg px-2.5 text-[16px] font-bold text-ink outline-none focus:border-green-ink"
      />
      <button
        type="submit"
        disabled={pending || !value.trim()}
        className="h-[42px] shrink-0 rounded-[11px] bg-green px-3.5 text-[14px] font-bold text-white disabled:opacity-60"
      >
        {t.common.save}
      </button>
    </form>
  );
}