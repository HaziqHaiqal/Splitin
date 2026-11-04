"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import {
  ArrowRightIcon,
  CheckIcon,
  CloseIcon,
  PencilIcon,
  PlusIcon,
  ReceiptIcon,
  ResetIcon,
  ShareIcon,
} from "@/components/icons";
import { dockButton, PrinterPage } from "@/components/receipt/printer";
import { Receipt } from "@/components/receipt/receipt";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useShareReceipt } from "@/hooks/use-share-receipt";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { BillDoc, PreviewItem } from "@/lib/bill";
import {
  emptyDraft,
  moveSharedDraft,
  saveDraft,
  updateDraft,
  useDraft,
  useLastShared,
  type LastShared,
} from "@/lib/store";
import { cn, newId, parseNames } from "@/lib/utils";
import { BillForm } from "./bill-form";
import { CodeForm, HomeIntro } from "./code-form";
import { PersonSheet } from "./person-sheet";

type FormState = { mode: "closed" | "add" | "edit"; editId: string | null; key: number };

export function BillsHome() {
  const { t, money } = useI18n();
  const toast = useToast();
  const stored = useDraft();
  const lastShared = useLastShared();
  const desktop = useIsDesktop();
  const { share, pending, leaving, sheet } = useShareReceipt(stored);
  const moved = Boolean(stored?.billId) && !leaving;

  const [personSheet, setPersonSheet] = useState<{ open: boolean; id: string | null; key: number }>({
    open: false,
    id: null,
    key: 0,
  });
  const [form, setForm] = useState<FormState>({ mode: "closed", editId: null, key: 0 });
  const [preview, setPreview] = useState<PreviewItem | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [peopleKey, setPeopleKey] = useState(0);
  const [peopleFresh, setPeopleFresh] = useState(false);
  const [entering, setEntering] = useState(false);
  const [starting, setStarting] = useState<StartDraft>(NEW_START);

  useEffect(() => {
    if (moved && stored) moveSharedDraft(stored);
  }, [moved, stored]);

  if (stored === undefined) return <div className="min-h-dvh bg-bg" />;

  const draft = moved ? null : stored;
  const doc = draft?.doc ?? emptyDraft().doc;
  const update = (fn: (doc: BillDoc) => BillDoc) => updateDraft((d) => ({ ...d, doc: fn(d.doc) }));

  const addNames = (names: string[]) => {
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
  const addPeople = (text: string) => addNames(parseNames(text));

  const startBill = (title: string, names: string[]) => {
    update((d) => ({ ...d, title }));
    addNames(names);
    setStarting(NEW_START);
  };

  const clearAll = () => {
    if (!draft) return;
    const previous = draft;
    saveDraft(null);
    setStarting(NEW_START);
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
  const openEdit = (item: { id: string }) => setForm((f) => ({ mode: "edit", editId: item.id, key: f.key + 1 }));
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

  const typedNames = [...starting.names, ...parseNames(starting.text)];
  const paper = !hasPeople ? (
    <Receipt
      doc={{
        ...doc,
        title: (starting.title ?? doc.title).trim(),
        people: typedNames.map((name, i) => ({ id: String(i), name, color: i })),
      }}
      variant="draft"
      people={{ key: starting.names.length, fresh: starting.names.length > 0 }}
      blank
    />
  ) : formOpen ? (
    <Receipt doc={doc} variant="draft" people={{ key: peopleKey, fresh: peopleFresh }} preview={preview} />
  ) : (
    <Receipt
      doc={doc}
      billId={draft?.billId}
      freshItemId={freshId}
      onItem={desktop ? undefined : openEdit}
    />
  );

  const codeLink = (className?: string) => (
    <button
      type="button"
      onClick={() => setEntering(true)}
      className={cn("h-9 self-start text-[13.5px] font-bold text-green-ink", className)}
    >
      {t.home.haveCode}
    </button>
  );
  const codeView = (
    <CodeForm backLabel={hasPeople ? t.home.codeBackBill : t.home.codeBackNew} onBack={() => setEntering(false)} />
  );

  const start = (
    <div className="flex flex-col md:mx-auto md:w-full md:max-w-[430px]">
      {desktop ? <HomeIntro title={t.home.startTitle} desc={t.home.startDesc} /> : null}
      {lastShared ? <SharedLine shared={lastShared} /> : null}
      <StartForm
        value={starting}
        savedTitle={doc.title}
        autoFocus={desktop}
        codeLink={codeLink()}
        onChange={setStarting}
        onStart={startBill}
      />
    </div>
  );

  const bills = !hasPeople ? (
    start
  ) : (
    <>
      <div className="flex items-center justify-between gap-2">
        <TitleEditor title={doc.title} onChange={(title) => update((d) => ({ ...d, title }))} />
        <ClearButton onClick={clearAll} />
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

  const side = (
    <>
      <div className={entering ? "hidden" : "contents"}>
        {bills}
        {hasPeople ? codeLink() : null}
      </div>
      {entering ? codeView : null}
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
              <div className="flex items-center justify-between gap-2">
                <TitleEditor small title={doc.title} onChange={(title) => update((d) => ({ ...d, title }))} />
                <ClearButton onClick={clearAll} />
              </div>
              {peopleChips(true)}
            </div>
          ) : undefined
        }
        phoneBelow={
          hasPeople && !formOpen && !entering ? <div className="flex justify-center">{codeLink()}</div> : undefined
        }
        panel={
          !hasPeople ? (
            <>
              <div className={entering ? "hidden" : undefined}>{start}</div>
              {entering ? codeView : null}
            </>
          ) : entering ? (
            codeView
          ) : formOpen ? (
            billForm(true)
          ) : undefined
        }
        dock={
          hasBills && !formOpen ? (
            <div className="grid grid-cols-[1fr_1.3fr] gap-2">
              <button
                type="button"
                onClick={openAdd}
                className={cn("inline-flex items-center justify-center gap-1.5", dockButton)}
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

function SharedLine({ shared }: { shared: LastShared }) {
  const { t } = useI18n();
  const [before, after = ""] = t.home.youShared.split("{title}");
  return (
    <div className="mb-3.5 flex min-h-11 items-center gap-2.5 rounded-xl bg-chip py-1 pr-1 pl-3 text-[13.5px] font-semibold text-muted md:mt-7 md:mb-0">
      <ReceiptIcon size={18} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {before}
        <b className="text-ink">{shared.title}</b>
        {after}
      </span>
      <Link
        href={`/bill/${shared.id}`}
        className="flex h-9 shrink-0 items-center px-2.5 text-[14px] font-extrabold text-green-ink"
      >
        {t.home.openShared} ›
      </Link>
    </div>
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

type StartDraft = { step: "title" | "names"; title: string | null; names: string[]; text: string };

const NEW_START: StartDraft = { step: "title", title: null, names: [], text: "" };

const keepFocus = (e: MouseEvent) => e.preventDefault();

function StartForm({
  value,
  savedTitle,
  autoFocus,
  codeLink,
  onChange,
  onStart,
}: {
  value: StartDraft;
  savedTitle: string;
  autoFocus: boolean;
  codeLink: ReactNode;
  onChange: (value: StartDraft) => void;
  onStart: (title: string, names: string[]) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const title = value.title ?? savedTitle;
  const naming = value.step === "names";
  const ready = naming ? value.names.length > 0 || value.text.trim().length > 0 : title.trim().length > 0;
  const set = (patch: Partial<StartDraft>) => onChange({ ...value, title, ...patch });

  const withNames = (found: string[]) => {
    const names = [...value.names];
    for (const name of found) {
      if (names.some((n) => n.toLowerCase() === name.toLowerCase())) {
        toast({ message: fmt(t.home.duplicateName, { name }) });
      } else {
        names.push(name);
      }
    }
    return names;
  };

  const type = (text: string) => {
    if (!naming) return set({ title: text });
    const parts = text.split(/[,;&\n]/);
    if (parts.length === 1) return set({ text });
    set({ names: withNames(parts.slice(0, -1).flatMap(parseNames)), text: parts[parts.length - 1].trimStart() });
  };

  const toNames = () => {
    if (title.trim()) set({ step: "names", title: title.trim() });
    input.current?.focus();
  };

  const finish = () => {
    const names = withNames(parseNames(value.text));
    if (names.length === 0) return input.current?.focus();
    onStart(title.trim(), names);
  };

  const enter = (e: FormEvent) => {
    e.preventDefault();
    if (!naming) return toNames();
    if (value.text.trim()) return set({ names: withNames(parseNames(value.text)), text: "" });
    finish();
  };

  const remove = (name: string) => {
    set({ names: value.names.filter((n) => n !== name) });
    input.current?.focus();
  };

  return (
    <form onSubmit={enter} className="flex flex-col gap-2.5 md:mt-7">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <label htmlFor="start-input" className="min-w-0 text-[17px] font-extrabold tracking-[-0.01em]">
          {naming ? t.home.step1 : t.home.titleQuestion}
        </label>
        {naming ? (
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={() => {
              set({ step: "title" });
              input.current?.focus();
            }}
            aria-label={t.home.editTitle}
            className="h-9 max-w-[45%] shrink-0 truncate text-[13.5px] font-bold text-muted"
          >
            ‹ {title}
          </button>
        ) : (
          codeLink
        )}
      </div>
      <div className="flex min-h-[52px] items-end gap-1.5 rounded-[14px] border border-border bg-card py-1.5 pr-1.5 pl-2 transition-shadow focus-within:border-green focus-within:shadow-[0_0_0_3px_var(--green-soft)]">
        <div className="flex min-h-10 min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {naming
            ? value.names.map((name) => (
                <span
                  key={name}
                  className="inline-flex h-8 shrink-0 animate-pop items-center rounded-full bg-chip pl-3 text-[14.5px] font-semibold"
                >
                  {name}
                  <button
                    type="button"
                    onMouseDown={keepFocus}
                    onClick={() => remove(name)}
                    aria-label={fmt(t.person.remove, { name })}
                    className="inline-flex size-7 items-center justify-center text-faint"
                  >
                    <CloseIcon size={12} strokeWidth={3} />
                  </button>
                </span>
              ))
            : null}
          <input
            ref={input}
            id="start-input"
            type="text"
            value={naming ? value.text : title}
            autoFocus={autoFocus}
            maxLength={naming ? undefined : 60}
            onChange={(e) => type(e.target.value)}
            onKeyDown={(e) => {
              if (naming && e.key === "Backspace" && !value.text && value.names.length > 0) {
                set({ names: value.names.slice(0, -1) });
              }
            }}
            placeholder={
              naming ? (value.names.length ? t.home.addMore : t.home.namesPlaceholder) : t.home.billNamePlaceholder
            }
            enterKeyHint={naming ? "done" : "next"}
            autoCapitalize="words"
            autoComplete="off"
            className="h-[38px] min-w-[120px] flex-1 bg-transparent px-1.5 text-[16px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-faint"
          />
        </div>
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={naming ? finish : toNames}
          aria-label={naming ? t.home.start : t.home.next}
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-white transition-colors",
            ready ? "bg-green" : "bg-dash",
          )}
        >
          <ArrowRightIcon size={18} strokeWidth={2.6} />
        </button>
      </div>
    </form>
  );
}
