"use client";

import Link from "next/link";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Avatar } from "@/components/avatar";
import { useDraftSync } from "@/components/draft-sync";
import { Header } from "@/components/header";
import { ArrowRightIcon, PencilIcon, PlusIcon, ResetIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { evenShare, type BillDoc, type Item, type Person } from "@/lib/bill";
import { emptyDraft, saveDraft, updateDraft, useDraft } from "@/lib/store";
import { cn, newId, parseNames } from "@/lib/utils";
import { BillSheet } from "./bill-sheet";
import { PersonSheet } from "./person-sheet";

export function BillsHome() {
  const { t, money, monthName } = useI18n();
  const toast = useToast();
  const draft = useDraft();
  useDraftSync(draft);
  const defaultTitle = fmt(t.receipt.defaultTitle, { month: monthName() });

  const [personSheet, setPersonSheet] = useState<{ open: boolean; id: string | null; key: number }>({ open: false, id: null, key: 0 });
  const [billSheet, setBillSheet] = useState<{ open: boolean; id: string | null; key: number }>({ open: false, id: null, key: 0 });

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
  };

  // Start over: wipe the people, bills and title on this device. A link that was already shared keeps working.
  const clearAll = () => {
    if (!draft) return;
    const previous = draft;
    saveDraft(null);
    toast({ message: t.home.cleared, action: { label: t.common.undo, onClick: () => saveDraft(previous) } });
  };

  const nameOf = (id: string) => doc.people.find((p) => p.id === id)?.name ?? "?";
  const total = doc.items.reduce((s, i) => s + i.amountMinor, 0);

  const openPerson = (id: string) => setPersonSheet((s) => ({ open: true, id, key: s.key + 1 }));
  const openBill = (id: string | null) => setBillSheet((s) => ({ open: true, id, key: s.key + 1 }));

  const hasPeople = doc.people.length > 0;
  const hasBills = doc.items.length > 0;

  // One column, top to bottom, the same on phone and desktop: people, then bills. The three numbered
  // steps are on screen from the first visit and just fill in; once there is a bill, step 3 becomes
  // the total bar along the bottom, whose "See receipt" opens the receipt page.
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col bg-bg px-4 pb-8 text-ink md:px-6 md:pb-12">
      <Header />
      <main className="flex flex-col gap-9 pt-3 md:gap-12 md:pt-6">
        <div className="flex items-center justify-between gap-2">
          {hasPeople ? (
            <>
              <TitleEditor title={doc.title} onChange={(title) => update((d) => ({ ...d, title }))} />
              <ClearButton onClick={clearAll} />
            </>
          ) : (
            <h1 className="m-0 text-[28px] leading-[1.12] font-extrabold tracking-[-0.025em] whitespace-pre-line md:text-[44px] md:leading-[1.05] md:tracking-[-0.03em]">{t.home.headline}</h1>
          )}
        </div>

        <section className="flex flex-col gap-3.5">
          <StepHeader n={1} title={t.home.step1} meta={hasPeople ? String(doc.people.length) : undefined} />
          {hasPeople ? (
            <div className="flex flex-wrap gap-2">
              {doc.people.map((p, index) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openPerson(p.id)}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-chip pr-[14px] pl-[5px] text-[14px] font-bold text-ink"
                >
                  <Avatar name={p.name} color={p.color} size={30} />
                  {p.name}
                  {!hasBills && index === 0 ? ` ${t.home.you}` : ""}
                </button>
              ))}
              <AddPersonChip onAdd={addPeople} />
            </div>
          ) : (
            <NamesForm onAdd={addPeople} />
          )}
        </section>

        <section className={cn("flex flex-col gap-3.5", !hasPeople && "opacity-55")}>
          <StepHeader n={2} title={t.home.step2} locked={!hasPeople} meta={hasBills ? fmt(t.home.tapToEdit, { count: doc.items.length }) : undefined} />
          {!hasPeople ? (
            <p className="m-0 text-[14px] text-muted">{t.home.step2Desc}</p>
          ) : hasBills ? (
            <div>
              {doc.items.map((item) => (
                <BillRow key={item.id} item={item} payer={nameOf(item.paidBy)} peopleCount={doc.people.length} onClick={() => openBill(item.id)} />
              ))}
              <button type="button" onClick={() => openBill(null)} className="flex h-[56px] w-full items-center gap-2 border-t border-line text-left text-[15px] font-bold text-green-ink">
                <PlusIcon />
                {t.home.addBill}
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openBill(null)}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-[#9fcbb2] text-[15px] font-bold text-green-ink dark:border-[#2f6b4b]"
              >
                <PlusIcon />
                {t.home.firstBill}
              </button>
              <p className="m-0 text-[13px] text-muted">{t.home.firstBillHint}</p>
            </>
          )}
        </section>

        {hasBills ? null : (
          <section className="flex flex-col gap-3.5 opacity-55">
            <StepHeader n={3} title={t.home.step3} locked />
            <p className="m-0 text-[14px] text-muted">{t.home.step3Desc}</p>
          </section>
        )}
      </main>

      {hasBills ? (
        <div className="sticky bottom-[max(16px,env(safe-area-inset-bottom))] z-20 mt-auto pt-10">
          <div className="flex items-center justify-between gap-3 rounded-[20px] border border-bar-border bg-bar py-[14px] pr-[14px] pl-[18px] text-bar-ink">
            <div className="min-w-0">
              <div className="text-[12px] text-bar-muted">{fmt(t.home.totalPeople, { count: doc.people.length })}</div>
              <div className="tabular text-[22px] font-extrabold">{money(total)}</div>
            </div>
            <Link href="/receipt" className="flex h-[50px] shrink-0 items-center gap-2 rounded-[14px] bg-green px-[18px] text-[15px] font-bold text-white no-underline">
              {t.home.seeReceipt}
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-auto pt-12 text-center text-[12px] text-muted">{t.home.expiryNote}</div>
      )}

      <PersonSheet
        key={`p-${personSheet.key}`}
        open={personSheet.open}
        onOpenChange={(open) => setPersonSheet((s) => ({ ...s, open }))}
        person={doc.people.find((p) => p.id === personSheet.id) ?? null}
        doc={doc}
        update={update}
      />
      <BillSheet
        key={`b-${billSheet.key}`}
        open={billSheet.open}
        onOpenChange={(open) => setBillSheet((s) => ({ ...s, open }))}
        item={doc.items.find((i) => i.id === billSheet.id) ?? null}
        doc={doc}
        update={update}
      />
    </div>
  );
}

function TitleEditor({ title, onChange }: { title: string; onChange: (title: string) => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState<string | null>(null);
  const commit = () => {
    const next = (value ?? "").trim().slice(0, 60);
    if (next && next !== title) onChange(next);
    setValue(null);
  };
  const text = "text-[24px] font-extrabold tracking-[-0.02em] md:text-[32px] md:tracking-[-0.025em]";
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
    <button type="button" onClick={() => setValue(title)} aria-label={t.home.editTitle} className={cn(text, "flex min-w-0 items-center gap-2 text-left text-ink")}>
      <span className="truncate">{title}</span>
      <PencilIcon className="shrink-0 text-faint" />
    </button>
  );
}

/** Quiet "start over" beside the title. It can be undone from the toast, so it asks no question. */
function ClearButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button type="button" onClick={onClick} className="-mr-2.5 flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap text-muted transition-colors hover:bg-chip hover:text-owe">
      <ResetIcon size={15} />
      {/* very small phones: icon only, so the title keeps its room */}
      <span className="max-[359px]:sr-only">{t.home.clearAll}</span>
    </button>
  );
}

function BillRow({ item, payer, peopleCount, onClick }: { item: Item; payer: string; peopleCount: number; onClick: () => void }) {
  const { t, money } = useI18n();
  const each = evenShare(item, peopleCount);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full items-center justify-between gap-2.5 border-t border-line text-left text-ink"
    >
      <span className="min-w-0">
        <span className="block truncate text-[16px] font-bold">{item.name}</span>
        <span className="mt-0.5 block text-[13px] text-muted">
          {each === null ? fmt(t.home.billUneven, { name: payer }) : fmt(each.exact ? t.home.billEach : t.home.billAbout, { name: payer, amount: money(each.amount) })}
        </span>
      </span>
      <span className="tabular shrink-0 text-[16px] font-extrabold">{money(item.amountMinor)}</span>
    </button>
  );
}

function AddPersonChip({ onAdd }: { onAdd: (text: string) => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const commit = () => {
    if (value.trim()) onAdd(value);
    setValue("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  };
  return (
    <label className="inline-flex h-10 items-center rounded-full border-[1.5px] border-dashed border-dash px-[14px]">
      <span className="sr-only">{t.home.addPersonLabel}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={t.home.addPerson}
        enterKeyHint="done"
        autoCapitalize="words"
        className="w-16 bg-transparent text-[14px] font-semibold text-ink outline-none placeholder:text-green-ink focus:w-28"
      />
    </label>
  );
}

/** Step 1 before anyone is added: one box that takes a single name or a pasted list. */
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
      <p className="m-0 text-[13px] text-muted">{t.home.step1Hint}</p>
    </>
  );
}

/** The numbered heading a step keeps in every state; grey until the step before it is done. */
function StepHeader({ n, title, meta, locked = false }: { n: number; title: string; meta?: string; locked?: boolean }) {
  return (
    <div className="flex min-h-9 items-center gap-2.5">
      <span className={cn("inline-flex size-[26px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold", locked ? "bg-disabled text-muted" : "bg-green text-white")}>{n}</span>
      <h2 className="m-0 text-[17px] font-extrabold md:text-[19px]">{title}</h2>
      {meta ? <span className="ml-auto text-[13px] whitespace-nowrap text-muted">{meta}</span> : null}
    </div>
  );
}

export type { Person };
