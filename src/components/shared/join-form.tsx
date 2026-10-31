"use client";

import { useState } from "react";
import type { MyBillChanges } from "@/app/actions";
import { CheckIcon } from "@/components/icons";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { itemShares, joinShare, ownerOf, type BillDoc } from "@/lib/bill";
import { parseMoney, toAutoPointInput, toInputValue } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PanelForm, SubmitButton } from "./panel-form";

const autoPoint = (v: string) => toAutoPointInput(v, "MYR");
const parse = (v: string) => parseMoney(v, "MYR") || undefined;

type Pick = { on: boolean; written?: number };

export function JoinForm({
  doc,
  me,
  tokens,
  bare,
  pending,
  onSave,
  onCancel,
}: {
  doc: BillDoc;
  me: string;
  tokens: Record<string, string>;
  bare: boolean;
  pending: boolean;
  onSave: (changes: MyBillChanges, undo: MyBillChanges) => void;
  onCancel: () => void;
}) {
  const { t, money, plain } = useI18n();
  const owner = ownerOf(doc)?.name ?? t.history.owner;

  const rows = doc.items.map((item) => {
    const token = item.joins?.[me] ? tokens[item.id] : undefined;
    const inIt = item.participants.includes(me);
    return { item, token, fixed: inIt && !token, full: !inIt && joinShare(item, me) === null };
  });
  const editable = rows.filter((r) => !r.fixed && !r.full);

  const [picks, setPicks] = useState<Record<string, Pick>>(() =>
    Object.fromEntries(
      rows.filter((r) => r.token).map((r) => [r.item.id, { on: true, written: r.item.overrides[me] }]),
    ),
  );
  const [editing, setEditing] = useState<{ id: string; value: string; start: string } | null>(null);

  const written = (id: string) =>
    editing?.id === id && editing.value !== editing.start ? parse(editing.value) : picks[id]?.written;
  const shareOf = (row: (typeof rows)[number]) => {
    if (row.fixed) return itemShares(row.item)[me] ?? 0;
    if (row.full || !picks[row.item.id]?.on) return null;
    return joinShare(row.item, me, written(row.item.id));
  };
  const tooMuch = (row: (typeof rows)[number]) =>
    !row.fixed && !row.full && Boolean(picks[row.item.id]?.on) && shareOf(row) === null;

  const toggle = (id: string) => {
    setEditing(null);
    setPicks((p) => ({ ...p, [id]: { on: !p[id]?.on, written: p[id]?.written } }));
  };
  const commit = () => {
    if (!editing) return;
    const value = written(editing.id);
    setPicks((p) => ({ ...p, [editing.id]: { on: true, written: value } }));
    setEditing(null);
  };
  const startEditing = (id: string, amount: number) => {
    const start = toInputValue(amount, "MYR");
    setPicks((p) => ({ ...p, [id]: { on: true, written: p[id]?.written } }));
    setEditing({ id, value: start, start });
  };

  const allOn = editable.length > 0 && editable.every((r) => picks[r.item.id]?.on);
  const setAll = () => {
    setEditing(null);
    setPicks((p) =>
      Object.fromEntries(editable.map((r) => [r.item.id, { on: !allOn, written: p[r.item.id]?.written }])),
    );
  };

  const changes: MyBillChanges = { join: [], change: [], leave: [] };
  const undo: MyBillChanges = { join: [], change: [], leave: [] };
  for (const { item, token } of editable) {
    const pick = picks[item.id];
    const before = item.overrides[me];
    const now = written(item.id);
    if (!token) {
      if (pick?.on) changes.join.push({ itemId: item.id, written: now });
    } else if (!pick?.on) {
      changes.leave.push({ itemId: item.id, token });
      undo.join.push({ itemId: item.id, written: before });
    } else if (now !== before) {
      changes.change.push({ itemId: item.id, token, written: now });
      undo.change.push({ itemId: item.id, token, written: before });
    }
  }
  const dirty = changes.join.length + changes.change.length + changes.leave.length > 0;
  const invalid = rows.some(tooMuch);
  const total = rows.reduce((sum, row) => sum + (shareOf(row) ?? 0), 0);

  return (
    <PanelForm title={t.join.title} bare={bare} onCancel={onCancel} onSubmit={() => onSave(changes, undo)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] text-muted">{t.join.hint}</span>
        {editable.length > 0 ? (
          <button type="button" onClick={setAll} className="h-7 shrink-0 text-[12.5px] font-bold text-green-ink">
            {allOn ? t.join.none : t.join.all}
          </button>
        ) : null}
      </div>

      <div className="flex flex-col">
        {rows.map((row) => {
          const { item, fixed, full } = row;
          const on = fixed || Boolean(picks[item.id]?.on);
          const share = shareOf(row);
          const isEditing = editing?.id === item.id;
          return (
            <div key={item.id} className="flex min-h-[52px] items-center gap-2.5 border-t border-line py-1.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={item.name}
                disabled={fixed || full}
                onClick={() => toggle(item.id)}
                className={cn(
                  "inline-flex size-[22px] shrink-0 items-center justify-center rounded-md",
                  on ? (fixed ? "bg-chip text-muted" : "bg-green text-white") : "border-2 border-dash",
                  full && "opacity-50",
                )}
              >
                {on ? <CheckIcon size={13} /> : null}
              </button>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[14px] font-semibold", !on && "text-muted")}>{item.name}</span>
                <span className={cn("block text-[12px] text-muted", tooMuch(row) && "font-semibold text-owe")}>
                  {tooMuch(row)
                    ? t.join.tooMuch
                    : fixed
                      ? t.join.inIt
                      : full
                        ? fmt(t.join.full, { name: owner })
                        : money(item.amountMinor)}
                </span>
              </span>
              {fixed ? (
                <span className="w-[92px] px-2.5 text-right text-[14px] font-bold text-muted tabular">
                  {plain(share ?? 0)}
                </span>
              ) : isEditing ? (
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  aria-label={fmt(t.join.amountOf, { name: item.name })}
                  value={editing.value}
                  onChange={(e) => setEditing({ ...editing, value: autoPoint(e.target.value) })}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commit();
                    }
                  }}
                  className="h-[34px] w-[92px] rounded-lg border-[1.5px] border-green bg-card px-2.5 text-right text-[16px] font-extrabold text-ink tabular shadow-[0_0_0_3px_var(--green-soft)] outline-none"
                />
              ) : (
                <button
                  type="button"
                  disabled={full}
                  aria-label={fmt(t.join.amountOf, { name: item.name })}
                  onClick={() => startEditing(item.id, share ?? joinShare(item, me) ?? 0)}
                  className={cn(
                    "h-[34px] w-[92px] rounded-lg border border-border bg-bg px-2.5 text-right text-[14px] font-bold tabular",
                    picks[item.id]?.written !== undefined ? "text-ink" : "text-muted",
                  )}
                >
                  {full ? "–" : on && share !== null ? plain(share) : plain(joinShare(item, me) ?? 0)}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between border-t border-line pt-2.5">
        <span className="text-[14px] text-muted">{t.join.you}</span>
        <b className="text-[19px] tabular">{money(total)}</b>
      </div>
      <SubmitButton disabled={pending || !dirty || invalid}>{t.common.save}</SubmitButton>
    </PanelForm>
  );
}
