"use client";

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Avatar } from "@/components/avatar";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { MAX_PEOPLE } from "@/lib/bill-schema";
import type { BillDoc } from "@/lib/bill";
import { newId, parseNames } from "@/lib/utils";
import { PanelForm, SubmitButton } from "./panel-form";

export type PeopleChange = {
  title: string;
  names: Record<string, string>;
  removed: string[];
  added: { id: string; name: string; color: number }[];
};

type Row = { id: string; name: string; was: string; color: number; fresh: boolean; removed: boolean };

const box =
  "h-11 w-full min-w-0 rounded-xl border-[1.5px] border-transparent bg-chip px-3 text-[16px] font-semibold text-ink outline-none focus:border-green focus:bg-card focus:shadow-[0_0_0_3px_var(--green-soft)]";

export function PeopleForm({
  doc,
  bare,
  pending,
  blocked,
  onSave,
  onCancel,
}: {
  doc: BillDoc;
  bare: boolean;
  pending: boolean;
  blocked: (id: string) => string | null;
  onSave: (change: PeopleChange) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [title, setTitle] = useState(doc.title);
  const [rows, setRows] = useState<Row[]>(() =>
    doc.people.map((p) => ({ id: p.id, name: p.name, was: p.name, color: p.color, fresh: false, removed: false })),
  );
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const focusSoon = (id: string) => requestAnimationFrame(() => inputs.current.get(id)?.focus());

  const nextColor = (all: Row[]) => all.reduce((max, r) => Math.max(max, r.color + 1), 0) % 100;
  const count = rows.filter((r) => !r.removed).length;

  const addRows = (after: string | null, names: string[], base = rows) => {
    const room = MAX_PEOPLE - base.filter((r) => !r.removed).length;
    if (room <= 0) return void toast({ message: fmt(t.page.maxPeople, { count: MAX_PEOPLE }) });
    const next = [...base];
    let at = after ? next.findIndex((r) => r.id === after) + 1 : next.length;
    let last = "";
    for (const name of names.slice(0, room)) {
      const row = { id: newId(6), name, was: "", color: nextColor(next), fresh: true, removed: false };
      next.splice(at++, 0, row);
      last = row.id;
    }
    setRows(next);
    focusSoon(last);
  };

  const setName = (id: string, name: string) => setRows((all) => all.map((r) => (r.id === id ? { ...r, name } : r)));

  const remove = (row: Row) => {
    if (row.fresh) return setRows((all) => all.filter((r) => r.id !== row.id));
    const reason = blocked(row.id);
    if (reason) return toast({ message: reason });
    setRows((all) => all.map((r) => (r.id === row.id ? { ...r, removed: true } : r)));
  };

  const restore = (row: Row) => {
    if (count >= MAX_PEOPLE) return toast({ message: fmt(t.page.maxPeople, { count: MAX_PEOPLE }) });
    setRows((all) => all.map((r) => (r.id === row.id ? { ...r, removed: false } : r)));
  };

  const onKey = (row: Row, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (row.name.trim()) addRows(row.id, [""]);
      return;
    }
    if (e.key === "Backspace" && row.fresh && row.name === "") {
      e.preventDefault();
      const live = rows.filter((r) => !r.removed);
      const before = live[live.findIndex((r) => r.id === row.id) - 1];
      setRows((all) => all.filter((r) => r.id !== row.id));
      if (before) focusSoon(before.id);
    }
  };

  const onPaste = (row: Row, e: ClipboardEvent<HTMLInputElement>) => {
    const names = parseNames(e.clipboardData.getData("text"));
    if (names.length < 2) return;
    e.preventDefault();
    if (row.name.trim()) return addRows(row.id, names);
    const [first, ...rest] = names;
    addRows(
      row.id,
      rest,
      rows.map((r) => (r.id === row.id ? { ...r, name: first } : r)),
    );
  };

  const submit = () =>
    onSave({
      title: title.trim(),
      names: Object.fromEntries(rows.filter((r) => !r.fresh && !r.removed).map((r) => [r.id, r.name.trim()])),
      removed: rows.filter((r) => r.removed).map((r) => r.id),
      added: rows
        .filter((r) => r.fresh && r.name.trim())
        .map((r) => ({ id: r.id, name: r.name.trim(), color: r.color })),
    });

  return (
    <PanelForm title={t.page.names} bare={bare} onCancel={onCancel} onSubmit={submit}>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] text-muted">{t.home.billName}</span>
        <input
          type="text"
          value={title}
          maxLength={60}
          autoComplete="off"
          onChange={(e) => setTitle(e.target.value)}
          className={box}
        />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-[12.5px] text-muted">{fmt(t.page.peopleCount, { count })}</span>
        {rows.map((row) =>
          row.removed ? (
            <div key={row.id} className="flex items-center gap-2.5">
              <Avatar name={row.name} color={row.color} size={32} className="opacity-35" />
              <span className="flex h-11 min-w-0 flex-1 items-center rounded-xl border-[1.5px] border-dashed border-dash px-3 text-[16px] font-semibold text-faint line-through">
                <span className="truncate">{row.name}</span>
              </span>
              <button
                type="button"
                onClick={() => restore(row)}
                className="h-11 w-[52px] shrink-0 text-[14px] font-extrabold text-green-ink"
              >
                {t.common.undo}
              </button>
            </div>
          ) : (
            <div key={row.id} className="flex items-center gap-2.5">
              <Avatar name={row.name || "?"} color={row.color} size={32} />
              <span className="relative min-w-0 flex-1">
                <input
                  ref={(el) => {
                    if (el) inputs.current.set(row.id, el);
                    else inputs.current.delete(row.id);
                  }}
                  type="text"
                  value={row.name}
                  maxLength={30}
                  autoCapitalize="words"
                  autoComplete="off"
                  enterKeyHint="next"
                  aria-label={row.fresh ? t.home.addPersonLabel : `${t.person.name}: ${row.was}`}
                  placeholder={row.fresh ? t.home.personPlaceholder : undefined}
                  onChange={(e) => setName(row.id, e.target.value)}
                  onKeyDown={(e) => onKey(row, e)}
                  onPaste={(e) => onPaste(row, e)}
                  className={row.id === doc.ownerId ? `${box} pr-20` : box}
                />
                {row.id === doc.ownerId ? (
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full bg-green-soft px-2 py-0.5 text-[11px] font-bold text-green-soft-ink">
                    {t.page.owner}
                  </span>
                ) : null}
              </span>
              {row.id === doc.ownerId ? (
                <span className="w-9 shrink-0" />
              ) : (
                <button
                  type="button"
                  onClick={() => remove(row)}
                  aria-label={fmt(t.person.remove, { name: row.was || row.name || t.home.personPlaceholder })}
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-chip text-muted hover:text-ink"
                >
                  <CloseIcon size={14} strokeWidth={2.6} />
                </button>
              )}
            </div>
          ),
        )}
        <button
          type="button"
          onClick={() => addRows(null, [""])}
          className="ml-[42px] inline-flex h-10 items-center gap-1.5 self-start rounded-full border-[1.5px] border-dashed border-dash px-3.5 text-[14px] font-bold text-green-ink hover:border-green"
        >
          <PlusIcon size={14} />
          {t.home.addPersonLabel}
        </button>
      </div>
      <SubmitButton disabled={pending}>{t.common.save}</SubmitButton>
    </PanelForm>
  );
}
