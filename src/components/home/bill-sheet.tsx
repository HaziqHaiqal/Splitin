"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { splitItem, type BillDoc, type Item } from "@/lib/bill";
import { parseMoney, toInputValue } from "@/lib/money";
import { cn, newId } from "@/lib/utils";

const cleanMoney = (v: string) => v.replace(/[^\d.,]/g, "");
const parse = (v: string) => parseMoney(v, "MYR");

export function BillSheet({
  open,
  onOpenChange,
  item,
  doc,
  update,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
  doc: BillDoc;
  update: (fn: (doc: BillDoc) => BillDoc) => void;
}) {
  const { t, money, plain } = useI18n();
  const toast = useToast();
  const isEdit = Boolean(item);
  const everyone = doc.people.map((p) => p.id);

  const [name, setName] = useState(item?.name ?? "");
  const [amount, setAmount] = useState(item ? toInputValue(item.amountMinor, "MYR") : "");
  const [paidBy, setPaidBy] = useState(item?.paidBy ?? everyone[0] ?? "");
  const [participants, setParticipants] = useState<string[]>(item?.participants ?? everyone);
  const [overrides, setOverrides] = useState<Record<string, number>>(item?.overrides ?? {});
  const [editing, setEditing] = useState<{ id: string; value: string; start: string } | null>(null);

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
  const fixedSum = included.reduce((s, id) => s + (liveOverrides[id] ?? 0), 0);

  const problem =
    !name.trim() ? null : amountMinor <= 0 ? null : !split.ok ? split.error : null;
  const canSave = Boolean(name.trim()) && amountMinor > 0 && split.ok && Boolean(paidBy);

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
    const cleanOverrides = Object.fromEntries(Object.entries(liveOverrides).filter(([id]) => included.includes(id)));
    const next: Item = {
      id: item?.id ?? newId(6),
      name: name.trim().slice(0, 60),
      amountMinor,
      paidBy,
      participants: included,
      overrides: cleanOverrides,
    };
    update((d) => ({ ...d, items: isEdit ? d.items.map((i) => (i.id === next.id ? next : i)) : [...d.items, next] }));
    onOpenChange(false);
  };

  const remove = () => {
    if (!item) return;
    const index = doc.items.findIndex((i) => i.id === item.id);
    update((d) => ({ ...d, items: d.items.filter((i) => i.id !== item.id) }));
    onOpenChange(false);
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

  const field = "h-[50px] w-full rounded-xl border border-border bg-card px-[14px] text-ink outline-none focus:border-[1.5px] focus:border-green focus:shadow-[0_0_0_4px_var(--green-soft)]";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={isEdit ? t.bill.editTitle : t.bill.addTitle}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex flex-col gap-[14px]"
      >
        <div className="flex gap-2.5">
          <label className="flex flex-[1.2] flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-muted">{t.bill.whatFor}</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={cn(field, "text-[16px] font-semibold")} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-muted">{t.bill.amount}</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(cleanMoney(e.target.value))}
              placeholder="0.00"
              className={cn(field, "tabular text-[18px] font-extrabold")}
            />
          </label>
        </div>

        {!isEdit ? (
          <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
            {t.bill.quick.map((q) => (
              <button key={q} type="button" onClick={() => setName(q)} className="h-8 shrink-0 rounded-full bg-chip px-3 text-[13px] font-semibold text-ink">
                {q}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-muted">{t.bill.whoPaid}</span>
          <div className="flex flex-wrap gap-2">
            {doc.people.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={paidBy === p.id}
                onClick={() => setPaidBy(p.id)}
                className={
                  paidBy === p.id
                    ? "h-[38px] rounded-full bg-green px-[14px] text-[14px] font-bold text-white"
                    : "h-[38px] rounded-full bg-chip px-[14px] text-[14px] font-semibold text-ink"
                }
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-muted">{hasOverrides ? t.bill.split : t.bill.splitEqually}</span>
            {hasOverrides ? (
              <button
                type="button"
                onClick={() => {
                  setOverrides({});
                  setEditing(null);
                }}
                className="h-7 text-[13px] font-bold text-green-ink"
              >
                {t.bill.resetEqual}
              </button>
            ) : (
              <span className="text-[12px] text-muted">{t.bill.tapToChange}</span>
            )}
          </div>
          {doc.people.map((p) => {
            const on = participants.includes(p.id);
            const isSet = on && liveOverrides[p.id] !== undefined;
            const share = split.ok ? split.shares[p.id] : undefined;
            const isEditing = editing?.id === p.id;
            return (
              <div key={p.id} className={cn("flex items-center gap-3", isSet ? "h-[52px]" : "h-12")}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={fmt(t.bill.include, { name: p.name })}
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "inline-flex size-[26px] shrink-0 items-center justify-center rounded-lg",
                    on ? "bg-green text-white" : "border-2 border-dash bg-transparent",
                  )}
                >
                  {on ? <CheckIcon /> : null}
                </button>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[15px] font-semibold", !on && "text-muted")}>{p.name}</span>
                  {isSet ? <span className="block text-[12px] font-semibold text-green-ink">{t.bill.youSetThis}</span> : null}
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
                    onChange={(e) => setEditing({ id: p.id, value: cleanMoney(e.target.value), start: editing?.start ?? "" })}
                    onBlur={commitEditing}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitEditing();
                      }
                    }}
                    className="tabular h-10 w-24 rounded-[10px] border-[1.5px] border-green bg-card px-3 text-right text-[15px] font-extrabold text-ink shadow-[0_0_0_4px_var(--green-soft)] outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    disabled={!on || amountMinor <= 0}
                    onClick={() => {
                      const current = share !== undefined ? toInputValue(share, "MYR") : "";
                      setEditing({ id: p.id, value: current, start: current });
                    }}
                    className={cn(
                      "tabular h-[38px] min-w-24 rounded-[10px] border border-border bg-field px-3 text-right text-[15px] font-bold",
                      hasOverrides ? "text-muted" : "text-ink",
                    )}
                  >
                    {on && share !== undefined ? plain(share) : "–"}
                  </button>
                )}
              </div>
            );
          })}
          {problem ? (
            <div className="mt-1 text-[13px] font-semibold text-owe">
              {problem === "over"
                ? fmt(t.bill.over, { amount: money(split.ok ? 0 : split.diff) })
                : problem === "under"
                  ? fmt(t.bill.under, { amount: money(split.ok ? 0 : split.diff) })
                  : t.bill.empty}
            </div>
          ) : hasOverrides ? (
            <div className="mt-1 text-[12px] text-muted">{fmt(t.bill.restHint, { amount: money(Math.max(0, amountMinor - fixedSum)) })}</div>
          ) : null}
        </div>

        <button type="submit" disabled={!canSave} className="h-[54px] rounded-2xl bg-green text-[16px] font-bold text-white disabled:bg-disabled disabled:text-disabled-ink">
          {isEdit ? t.bill.saveChanges : t.bill.addButton}
        </button>
        {isEdit ? (
          <button type="button" onClick={remove} className="-mt-1.5 h-10 text-[15px] font-bold text-owe">
            {t.bill.delete}
          </button>
        ) : null}
      </form>
    </Sheet>
  );
}
