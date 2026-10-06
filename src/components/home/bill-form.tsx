"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { fmt, intlLocale } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { splitItem, type BillDoc, type Item } from "@/lib/bill";
import { parseMoney, toInputValue } from "@/lib/money";
import { cn, newId } from "@/lib/utils";

const cleanMoney = (v: string) => v.replace(/[^\d.,]/g, "");
const parse = (v: string) => parseMoney(v, "MYR");

/**
 * Add or edit one bill, inline. While adding, every change is reported through `onPreview`, so the printer can show
 * the bill as a dashed line before it is printed. "Print it" (or Enter) saves it.
 * Desktop shows it as a card next to the printer; phones put it in the bottom panel (`bare`).
 */
export function BillForm({
  item,
  doc,
  update,
  first,
  bare = false,
  autoFocus = false,
  onPrinted,
  onCancel,
  onPreview,
}: {
  item: Item | null;
  doc: BillDoc;
  update: (fn: (doc: BillDoc) => BillDoc) => void;
  /** No bills yet: titled "Add the first bill". */
  first: boolean;
  bare?: boolean;
  autoFocus?: boolean;
  onPrinted: (id: string) => void;
  onCancel?: () => void;
  onPreview: (item: Item | null) => void;
}) {
  const { t, money, plain, locale } = useI18n();
  const toast = useToast();
  const isEdit = Boolean(item);
  const everyone = doc.people.map((p) => p.id);

  const [name, setName] = useState(item?.name ?? "");
  const [amount, setAmount] = useState(item ? toInputValue(item.amountMinor, "MYR") : "");
  const [paidBy, setPaidBy] = useState(item?.paidBy ?? everyone[0] ?? "");
  const [participants, setParticipants] = useState<string[]>(item?.participants ?? everyone);
  const [overrides, setOverrides] = useState<Record<string, number>>(item?.overrides ?? {});
  const [editing, setEditing] = useState<{ id: string; value: string; start: string } | null>(null);
  const [showSplit, setShowSplit] = useState(false);

  const amountMinor = parse(amount) ?? 0;
  const included = everyone.filter((id) => participants.includes(id));
  const liveOverrides = { ...overrides };
  if (editing && editing.value !== editing.start) {
    const v = parse(editing.value);
    if (v === null) delete liveOverrides[editing.id];
    else liveOverrides[editing.id] = v;
  }
  const split = splitItem(amountMinor, included, liveOverrides);
  const hasOverrides = Object.keys(liveOverrides).some((id) => included.includes(id));
  const custom = hasOverrides || included.length !== everyone.length;
  const expanded = showSplit || custom;
  const fixedSum = included.reduce((s, id) => s + (liveOverrides[id] ?? 0), 0);
  const cleanOverrides = Object.fromEntries(Object.entries(liveOverrides).filter(([id]) => included.includes(id)));

  // "Everyone except Najmi shares the rest (RM 150.00) equally: RM 50.00 each."
  const nameOf = (id: string) => doc.people.find((p) => p.id === id)?.name ?? "?";
  const list = (ids: string[]) =>
    new Intl.ListFormat(intlLocale(locale), { type: "conjunction" }).format(ids.map(nameOf));
  const freeIds = included.filter((id) => liveOverrides[id] === undefined);
  const setIds = included.filter((id) => liveOverrides[id] !== undefined);
  const freeShares = split.ok ? freeIds.map((id) => split.shares[id] ?? 0) : [];
  const restHint = (() => {
    if (!hasOverrides || freeIds.length === 0 || !split.ok) return null;
    const rest = money(Math.max(0, amountMinor - fixedSum));
    const same = freeShares.every((v) => v === freeShares[0]);
    const each = same
      ? money(freeShares[0])
      : `${t.bill.about} ${money(Math.round(freeShares.reduce((a, b) => a + b, 0) / freeShares.length))}`;
    if (included.length === everyone.length) return fmt(t.bill.restExcept, { names: list(setIds), rest, each });
    return fmt(freeIds.length === 1 ? t.bill.restOne : t.bill.restNames, { names: list(freeIds), rest, each });
  })();

  const problem = !name.trim() ? null : amountMinor <= 0 ? null : !split.ok ? split.error : null;
  const canSave = Boolean(name.trim()) && amountMinor > 0 && split.ok && Boolean(paidBy);

  // the dashed line on the paper: a new bill appears at the end, an edited one is redrawn in its own place
  const previewKey = JSON.stringify([name, amountMinor, paidBy, included, cleanOverrides, split.ok]);
  useEffect(() => {
    const typing = isEdit || name.trim() !== "" || amountMinor > 0;
    onPreview(
      typing
        ? {
            id: item?.id ?? "preview",
            name,
            amountMinor,
            paidBy,
            participants: included,
            overrides: split.ok ? cleanOverrides : {},
          }
        : null,
    );
    // previewKey stands for every value the preview is built from
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, isEdit]);
  useEffect(() => () => onPreview(null), [onPreview]);

  const commitEditing = () => {
    if (!editing) return;
    if (editing.value === editing.start) {
      setEditing(null);
      return;
    }
    const v = parse(editing.value);
    setOverrides((o) => {
      const next = { ...o };
      if (v === null) delete next[editing.id];
      else next[editing.id] = v;
      return next;
    });
    setEditing(null);
  };

  const toggle = (id: string) => {
    setParticipants((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    setOverrides((o) => {
      const next = { ...o };
      delete next[id];
      return next;
    });
  };

  const save = () => {
    if (!canSave) return;
    const next: Item = {
      id: item?.id ?? newId(6),
      name: name.trim().slice(0, 60),
      amountMinor,
      paidBy,
      participants: included,
      overrides: cleanOverrides,
    };
    update((d) => ({ ...d, items: isEdit ? d.items.map((i) => (i.id === next.id ? next : i)) : [...d.items, next] }));
    onPreview(null);
    onPrinted(next.id);
    if (!isEdit) {
      setName("");
      setAmount("");
      setOverrides({});
      setParticipants(everyone);
      setShowSplit(false);
    }
  };

  const remove = () => {
    if (!item) return;
    const index = doc.items.findIndex((i) => i.id === item.id);
    update((d) => ({ ...d, items: d.items.filter((i) => i.id !== item.id) }));
    onCancel?.();
    toast({
      message: fmt(t.bill.deleted, { name: item.name }),
      action: {
        label: t.common.undo,
        onClick: () =>
          update((d) => {
            if (d.items.some((i) => i.id === item.id)) return d;
            const items = [...d.items];
            items.splice(Math.min(index, items.length), 0, item);
            return { ...d, items };
          }),
      },
    });
  };

  // "Split equally · RM 45.00 each" while everyone shares it equally
  const shares = split.ok ? Object.values(split.shares) : [];
  const evenEach = shares.length > 0 ? Math.round(amountMinor / shares.length) : 0;
  const exact = shares.length > 0 && shares.every((v) => v === shares[0]);
  const equalLine =
    amountMinor > 0 && shares.length > 0
      ? fmt(exact ? t.bill.splitEachLine : t.bill.splitAboutLine, { amount: money(evenEach) })
      : t.bill.splitEveryone;

  const field =
    "h-[44px] w-full min-w-0 rounded-xl border border-border bg-card px-3.5 text-[15px] text-ink outline-none placeholder:font-normal focus:border-[1.5px] focus:border-green focus:shadow-[0_0_0_3px_var(--green-soft)]";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className={cn("flex flex-col", bare ? "gap-2.5" : "gap-3 rounded-2xl border border-border bg-card p-4")}
    >
      {/* the title, and a round × to close the form (only once there are bills to go back to) */}
      <div className="flex min-h-9 items-center justify-between gap-3">
        <span className="text-[16px] font-extrabold tracking-[-0.01em]">
          {isEdit ? t.bill.editTitle : first ? t.bill.firstTitle : t.bill.addTitle}
        </span>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label={t.friend.cancel}
            title={t.friend.cancel}
            className="-mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-chip text-muted transition-colors hover:text-ink"
          >
            <CloseIcon size={17} />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-[1.3fr_1fr] gap-2">
        <input
          type="text"
          value={name}
          autoFocus={autoFocus}
          aria-label={t.bill.whatFor}
          placeholder={t.bill.namePlaceholder}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className={cn(field, "font-semibold")}
        />
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          aria-label={t.bill.amount}
          placeholder="0.00"
          onChange={(e) => setAmount(cleanMoney(e.target.value))}
          className={cn(field, "text-[16px] font-extrabold tabular")}
        />
      </div>

      <div className={cn("flex flex-col", bare ? "gap-1.5" : "gap-2")}>
        <span className="text-[12.5px] text-muted">{t.bill.whoPaid}</span>
        {/* phones: one row that scrolls sideways instead of wrapping onto more lines */}
        <div className={cn("flex gap-1.5", bare ? "-mx-4 [scrollbar-width:none] overflow-x-auto px-4" : "flex-wrap")}>
          {doc.people.map((p) => {
            const on = paidBy === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPaidBy(p.id)}
                className={cn(
                  "inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full pr-3 pl-1 text-[13px] font-bold",
                  on ? "bg-green text-white" : "bg-chip text-ink",
                )}
              >
                <Avatar name={p.name} color={p.color} size={26} />
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {expanded ? (
        <div className="flex flex-col">
          <div className="flex items-baseline justify-between">
            <span className="text-[12.5px] text-muted">{t.bill.split}</span>
            {custom ? (
              <button
                type="button"
                onClick={() => {
                  setOverrides({});
                  setParticipants(everyone);
                  setEditing(null);
                }}
                className="h-7 text-[12.5px] font-bold text-green-ink"
              >
                {t.bill.resetEqual}
              </button>
            ) : (
              <span className="text-[12px] text-faint">{t.bill.tapToChange}</span>
            )}
          </div>
          {doc.people.map((p) => {
            const on = participants.includes(p.id);
            const isSet = on && liveOverrides[p.id] !== undefined;
            const share = split.ok ? split.shares[p.id] : undefined;
            const isEditing = editing?.id === p.id;
            return (
              <div key={p.id} className="flex h-11 items-center gap-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={fmt(t.bill.include, { name: p.name })}
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "inline-flex size-[22px] shrink-0 items-center justify-center rounded-md",
                    on ? "bg-green text-white" : "border-2 border-dash",
                  )}
                >
                  {on ? <CheckIcon size={13} /> : null}
                </button>
                <span className={cn("min-w-0 flex-1 truncate text-[14px] font-semibold", !on && "text-muted")}>
                  {p.name}
                  {isSet ? <span className="ml-1.5 text-[11.5px] text-green-ink">{t.bill.youSetThis}</span> : null}
                </span>
                {isEditing || isSet ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus={isEditing}
                    aria-label={fmt(t.bill.amountOf, { name: p.name })}
                    value={isEditing ? editing.value : toInputValue(liveOverrides[p.id] ?? 0, "MYR")}
                    onFocus={() => {
                      if (!isEditing) {
                        const current = toInputValue(liveOverrides[p.id] ?? 0, "MYR");
                        setEditing({ id: p.id, value: current, start: current });
                      }
                    }}
                    onChange={(e) =>
                      setEditing({ id: p.id, value: cleanMoney(e.target.value), start: editing?.start ?? "" })
                    }
                    onBlur={commitEditing}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitEditing();
                      }
                    }}
                    className="h-[34px] w-[84px] rounded-lg border-[1.5px] border-green bg-card px-2.5 text-right text-[14px] font-extrabold text-ink tabular shadow-[0_0_0_3px_var(--green-soft)] outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    disabled={!on || amountMinor <= 0}
                    onClick={() => {
                      const current = share !== undefined ? toInputValue(share, "MYR") : "";
                      setEditing({ id: p.id, value: current, start: current });
                    }}
                    className="h-[34px] w-[84px] rounded-lg border border-border bg-bg px-2.5 text-right text-[14px] font-bold text-muted tabular"
                  >
                    {on && share !== undefined ? plain(share) : "–"}
                  </button>
                )}
              </div>
            );
          })}
          {problem ? (
            <div className="text-[12.5px] font-semibold text-owe">
              {problem === "over"
                ? fmt(t.bill.over, { amount: money(split.ok ? 0 : split.diff) })
                : problem === "under"
                  ? fmt(t.bill.under, { amount: money(split.ok ? 0 : split.diff) })
                  : t.bill.empty}
            </div>
          ) : restHint ? (
            <div className="text-[12px] text-muted">{restHint}</div>
          ) : null}
        </div>
      ) : (
        <div className="text-[12.5px] text-muted">
          {equalLine} ·{" "}
          <button type="button" onClick={() => setShowSplit(true)} className="font-bold text-green-ink">
            {t.bill.change}
          </button>
        </div>
      )}

      <div className={cn("flex items-center gap-3", isEdit ? "justify-between" : "justify-end")}>
        {isEdit ? (
          <button type="button" onClick={remove} className="h-10 text-[13.5px] font-bold text-owe">
            {t.bill.delete}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={!canSave}
          className={cn(
            "h-[44px] rounded-xl bg-green px-5 text-[15px] font-bold text-white disabled:bg-disabled disabled:text-disabled-ink",
            bare && !isEdit && "w-full",
          )}
        >
          {isEdit ? t.common.save : `${t.bill.printIt} ↵`}
        </button>
      </div>
    </form>
  );
}
