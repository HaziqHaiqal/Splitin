"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Avatar } from "@/components/avatar";
import { useDraftSync } from "@/components/draft-sync";
import { BackIcon, CheckIcon, PencilIcon, PlusIcon, ResetIcon, ShareIcon } from "@/components/icons";
import { PaperStub, PrinterPage } from "@/components/receipt/printer";
import { Receipt } from "@/components/receipt/receipt";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useShareReceipt } from "@/hooks/use-share-receipt";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { BillDoc, Item } from "@/lib/bill";
import { emptyDraft, saveDraft, updateDraft, useDraft } from "@/lib/store";
import { cn, newId, parseNames } from "@/lib/utils";
import { BillForm } from "./bill-form";
import { PersonSheet } from "./person-sheet";

type FormState = { mode: "closed" | "add" | "edit"; editId: string | null; key: number };

export function BillsHome() {
  const { t, money, monthName } = useI18n();
  const toast = useToast();
  const draft = useDraft();
  useDraftSync(draft);
  const desktop = useIsDesktop();
  const defaultTitle = fmt(t.receipt.defaultTitle, { month: monthName() });
  const { share, pending, receiptRef, sheet } = useShareReceipt(draft);

  const [personSheet, setPersonSheet] = useState<{ open: boolean; id: string | null; key: number }>({
    open: false,
    id: null,
    key: 0,
  });
  const [form, setForm] = useState<FormState>({ mode: "closed", editId: null, key: 0 });
  const [preview, setPreview] = useState<Item | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [peopleKey, setPeopleKey] = useState(0);
  const [peopleFresh, setPeopleFresh] = useState(false);

  if (draft === undefined) return <div className="min-h-dvh bg-bg" />;

  const doc = draft?.doc ?? emptyDraft(defaultTitle).doc;
  const update = (fn: (doc: BillDoc) => BillDoc) => updateDraft(defaultTitle, (d) => ({ ...d, doc: fn(d.doc) }));

  const addPeople = (text: string) => {
    const names = parseNames(text);
    if (names.length === 0) return;
    update((d) => {
      const taken = new Set(d.people.map((p) => p.name.toLowerCase()));
      const people = [...d.people];
      let color = d.people.reduce((max, p) => Math.max(max, p.color + 1), 0);
      for (const name of names) {
        if (taken.has(name.toLowerCase())) {
          toast({ message: fmt(t.home.duplicateName, { name }) });
          continue;
        }
        taken.add(name.toLowerCase());
        people.push({ id: newId(6), name, color: color++ });
      }
      return { ...d, people };
    });
    setPeopleKey((k) => k + 1);
    setPeopleFresh(true);
  };

  const clearAll = () => {
    if (!draft) return;
    const previous = draft;
    saveDraft(null);
    setForm((f) => ({ mode: "closed", editId: null, key: f.key + 1 }));
    toast({ message: t.home.cleared, action: { label: t.common.undo, onClick: () => saveDraft(previous) } });
  };

  const hasPeople = doc.people.length > 0;
  const hasBills = doc.items.length > 0;
  const formOpen = hasPeople && (form.mode !== "closed" || !hasBills);
  const editing = form.mode === "edit" ? (doc.items.find((i) => i.id === form.editId) ?? null) : null;
  const total = doc.items.reduce((s, i) => s + i.amountMinor, 0);
  const nameOf = (id: string) => doc.people.find((p) => p.id === id)?.name ?? "?";

  const openPerson = (id: string) => setPersonSheet((s) => ({ open: true, id, key: s.key + 1 }));
  const openAdd = () => setForm((f) => ({ mode: "add", editId: null, key: f.key + 1 }));
  const openEdit = (item: Item) => setForm((f) => ({ mode: "edit", editId: item.id, key: f.key + 1 }));
  const closeForm = () => setForm((f) => ({ mode: "closed", editId: null, key: f.key + 1 }));
  const printed = (id: string) => {
    setFreshId(id);
    setPeopleFresh(false);
    closeForm();
  };

  const billForm = (bare: boolean) => (
    <BillForm
      key={form.key}
      item={editing}
      doc={doc}
      update={update}
      first={!hasBills}
      bare={bare}
      autoFocus={desktop && hasBills}
      onPrinted={printed}
      onCancel={hasBills ? closeForm : undefined}
      onPreview={setPreview}
    />
  );

  const peopleChips = (compact: boolean) => (
    <div className={cn("flex gap-1.5", compact ? "-mx-4 [scrollbar-width:none] overflow-x-auto px-4" : "flex-wrap")}>
      {doc.people.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => openPerson(p.id)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-chip pr-3 pl-1 font-bold text-ink",
            compact ? "h-8 text-[12.5px]" : "h-9 text-[13.5px]",
          )}
        >
          <Avatar name={p.name} color={p.color} size={compact ? 24 : 28} />
          {p.name}
        </button>
      ))}
      <AddPersonChip onAdd={addPeople} />
    </div>
  );

  const paper = !hasPeople ? (
    <PaperStub text={t.home.stubHint} />
  ) : formOpen ? (
    <Receipt doc={doc} variant="draft" people={{ key: peopleKey, fresh: peopleFresh }} preview={preview} />
  ) : (
    <Receipt
      ref={receiptRef}
      doc={doc}
      billId={draft?.billId}
      freshItemId={freshId}
      onItem={desktop ? undefined : openEdit}
    />
  );

  const start = (
    <>
      <h1 className="m-0 text-[30px] leading-[1.1] font-extrabold tracking-[-0.03em] whitespace-pre-line md:text-[40px]">
        {t.home.startTitle}
      </h1>
      <p className="m-0 max-w-[44ch] text-[14px] leading-[1.5] text-muted">{t.home.startDesc}</p>
      <span className="text-[11px] font-bold tracking-[0.06em] text-faint uppercase">{t.home.step1}</span>
      <NamesForm onAdd={addPeople} />
    </>
  );

  const backToPayments = draft?.billId ? (
    <Link
      href={`/bill/${draft.billId}`}
      className="-ml-1 inline-flex items-center gap-0.5 self-start text-[13.5px] font-bold text-green-ink no-underline"
    >
      <BackIcon size={16} />
      {t.home.backToPayments}
    </Link>
  ) : null;

  const side = !hasPeople ? (
    start
  ) : (
    <>
      <div className="flex flex-col gap-2">
        {backToPayments}
        <div className="flex items-center justify-between gap-2">
          <TitleEditor title={doc.title} onChange={(title) => update((d) => ({ ...d, title }))} />
          <ClearButton onClick={clearAll} />
        </div>
      </div>
      {peopleChips(false)}
      {formOpen ? (
        billForm(false)
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card px-4 py-1">
            {doc.items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openEdit(item)}
                className={cn(
                  "flex min-h-[52px] w-full items-center justify-between gap-3 text-left",
                  i > 0 && "border-t border-line",
                )}
              >
                <span className="min-w-0 truncate">
                  <b className="text-[14.5px]">{item.name}</b>
                  <span className="text-[13px] text-muted"> · {nameOf(item.paidBy)}</span>
                </span>
                <b className="shrink-0 text-[14.5px] tabular">{money(item.amountMinor)}</b>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex h-[42px] items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-[14px] font-bold text-ink"
            >
              <PlusIcon size={16} />
              {t.home.nextBill}
            </button>
            <span className="text-[14px] text-muted">
              {t.home.total} <b className="text-[19px] text-ink tabular">{money(total)}</b>
            </span>
          </div>
        </>
      )}
    </>
  );

  const shareButton = (
    <button
      type="button"
      onClick={share}
      disabled={pending}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-green px-6 text-[15px] font-bold text-white disabled:opacity-60"
    >
      <ShareIcon size={18} />
      {t.receipt.share}
    </button>
  );

  return (
    <>
      <PrinterPage
        side={side}
        paper={paper}
        below={hasBills && !formOpen ? shareButton : undefined}
        phoneTop={
          hasPeople ? (
            <div className="flex flex-col gap-2 px-1">
              {backToPayments}
              <div className="flex items-center justify-between gap-2">
                <TitleEditor small title={doc.title} onChange={(title) => update((d) => ({ ...d, title }))} />
                <ClearButton onClick={clearAll} />
              </div>
              {peopleChips(true)}
            </div>
          ) : undefined
        }
        panel={!hasPeople ? <div className="flex flex-col gap-3">{start}</div> : formOpen ? billForm(true) : undefined}
        dock={
          hasBills && !formOpen ? (
            <div className="grid grid-cols-[1fr_1.3fr] gap-2">
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-[15px] font-bold text-ink shadow-[0_4px_14px_rgba(55,53,47,0.10)]"
              >
                <PlusIcon size={16} />
                {t.home.nextBill}
              </button>
              {shareButton}
            </div>
          ) : undefined
        }
        follow={
          formOpen ? `${doc.people.length}:${doc.items.length}:${preview ? JSON.stringify(preview) : ""}` : undefined
        }
      />
      <PersonSheet
        key={`p-${personSheet.key}`}
        open={personSheet.open}
        onOpenChange={(open) => setPersonSheet((s) => ({ ...s, open }))}
        person={doc.people.find((p) => p.id === personSheet.id) ?? null}
        doc={doc}
        update={update}
      />
      {sheet}
    </>
  );
}

function TitleEditor({
  title,
  onChange,
  small = false,
}: {
  title: string;
  onChange: (title: string) => void;
  small?: boolean;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState<string | null>(null);
  const commit = () => {
    const next = (value ?? "").trim().slice(0, 60);
    if (next && next !== title) onChange(next);
    setValue(null);
  };
  const text = small
    ? "text-[18px] font-extrabold tracking-[-0.015em]"
    : "text-[30px] font-extrabold tracking-[-0.025em]";
  if (value !== null) {
    return (
      <input
        autoFocus
        type="text"
        value={value}
        maxLength={60}
        aria-label={t.home.editTitle}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setValue(null);
        }}
        className={cn(text, "w-full min-w-0 border-b-2 border-green bg-transparent text-ink outline-none")}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setValue(title)}
      aria-label={t.home.editTitle}
      className={cn(text, "flex min-w-0 items-center gap-2 text-left text-ink")}
    >
      <span className="truncate">{title}</span>
      <PencilIcon className="shrink-0 text-faint" />
    </button>
  );
}

function ClearButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mr-2.5 flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap text-muted transition-colors hover:bg-chip hover:text-owe"
    >
      <ResetIcon size={15} />
      <span className="max-[359px]:sr-only">{t.home.clearAll}</span>
    </button>
  );
}

function AddPersonChip({ onAdd }: { onAdd: (text: string) => void }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const cancelled = useRef(false);
  const commit = () => {
    if (value.trim()) onAdd(value);
    setValue("");
  };
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          cancelled.current = false;
          setEditing(true);
        }}
        className="inline-flex h-9 shrink-0 items-center rounded-full border-[1.5px] border-dashed border-dash px-[14px] text-[14px] font-semibold whitespace-nowrap text-green-ink transition-colors hover:border-green"
      >
        {t.home.addPerson}
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
      className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border-[1.5px] border-green bg-card pr-1 pl-[14px] shadow-[0_0_0_3px_var(--green-soft)]"
    >
      <label htmlFor="add-person" className="sr-only">
        {t.home.addPersonLabel}
      </label>
      <input
        id="add-person"
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Escape") {
            cancelled.current = true;
            setValue("");
            setEditing(false);
          }
        }}
        onBlur={() => {
          if (!cancelled.current) commit();
          setEditing(false);
        }}
        placeholder={t.home.personPlaceholder}
        enterKeyHint="done"
        autoCapitalize="words"
        autoComplete="off"
        className="w-28 bg-transparent text-[14px] font-semibold text-ink outline-none"
      />
      <button
        type="submit"
        aria-label={t.common.add}
        onMouseDown={(e) => e.preventDefault()}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-green text-white"
      >
        <CheckIcon size={14} />
      </button>
    </form>
  );
}

function NamesForm({ onAdd }: { onAdd: (text: string) => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(value);
    setValue("");
  };
  return (
    <>
      <form onSubmit={submit} className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">{t.home.namesLabel}</span>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t.home.namesPlaceholder}
            autoCapitalize="words"
            autoComplete="off"
            className="h-12 w-full rounded-xl border-[1.5px] border-green bg-card px-[14px] text-[16px] text-ink shadow-[0_0_0_4px_var(--green-soft)] outline-none"
          />
        </label>
        <button type="submit" className="h-12 rounded-xl bg-green px-[18px] text-[15px] font-bold text-white">
          {t.common.add}
        </button>
      </form>
      <p className="m-0 text-[12.5px] text-muted">{t.home.step1Hint}</p>
    </>
  );
}
