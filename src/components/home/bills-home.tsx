"use client";

import Link from "next/link";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Avatar } from "@/components/avatar";
import { useDraftSync } from "@/components/draft-sync";
import { Header } from "@/components/header";
import { ArrowRightIcon, PencilIcon, PlusIcon } from "@/components/icons";
import { useIsDesktop } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { evenShare, type BillDoc, type Item, type Person } from "@/lib/bill";
import { emptyDraft, updateDraft, useDraft } from "@/lib/store";
import { newId, parseNames } from "@/lib/utils";
import { BillSheet } from "./bill-sheet";
import { PersonSheet } from "./person-sheet";
import { ReceiptPanel, ReceiptPlaceholder } from "@/components/receipt/receipt-panel";

const card = "rounded-[20px] bg-card shadow-[0_1px_2px_rgba(28,31,29,0.06)]";

export function BillsHome() {
  const { t, money, monthName } = useI18n();
  const toast = useToast();
  const draft = useDraft();
  useDraftSync(draft);
  const desktop = useIsDesktop();
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

  const nameOf = (id: string) => doc.people.find((p) => p.id === id)?.name ?? "?";
  const total = doc.items.reduce((s, i) => s + i.amountMinor, 0);

  const openPerson = (id: string) => setPersonSheet((s) => ({ open: true, id, key: s.key + 1 }));
  const openBill = (id: string | null) => setBillSheet((s) => ({ open: true, id, key: s.key + 1 }));

  const sheets = (
    <>
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
    </>
  );

  if (doc.people.length === 0) return <EmptyStart onAdd={addPeople} />;

  const hasBills = doc.items.length > 0;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-3 bg-bg px-4 pt-[14px] pb-[22px] text-ink md:max-w-[1080px] md:px-6 xl:px-8 md:pt-6 md:pb-10">
      <Header />
      <div className="flex flex-1 flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_350px] xl:grid-cols-[minmax(0,1fr)_390px] md:items-start md:gap-6 xl:gap-10 md:pt-6">
      <div className="flex flex-col gap-3 md:gap-4">
      <TitleEditor title={doc.title} onChange={(title) => update((d) => ({ ...d, title }))} />

      <section className={`${card} flex flex-col gap-2.5 px-4 py-[14px]`}>
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-extrabold">{t.home.people}</span>
          <span className="text-[13px] text-muted">{hasBills ? doc.people.length : fmt(t.home.tapToEdit, { count: doc.people.length })}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {doc.people.map((p, index) => (
            <button
              key={p.id}
              type="button"
              onClick={() => openPerson(p.id)}
              className={`inline-flex items-center gap-1.5 rounded-full bg-chip pr-3 pl-1 text-[14px] font-bold text-ink ${hasBills ? "h-9" : "h-10 gap-2 pr-[14px] pl-[5px]"}`}
            >
              <Avatar name={p.name} color={p.color} size={hasBills ? 28 : 30} />
              {p.name}
              {!hasBills && index === 0 ? ` ${t.home.you}` : ""}
            </button>
          ))}
          <AddPersonChip onAdd={addPeople} tall={!hasBills} />
        </div>
      </section>

      {hasBills ? (
        <section className={`${card} px-4 py-1`}>
          <div className="flex h-[46px] items-center justify-between">
            <span className="text-[17px] font-extrabold">{t.home.bills}</span>
            <span className="text-[13px] text-muted">{fmt(t.home.tapToEdit, { count: doc.items.length })}</span>
          </div>
          {doc.items.map((item) => (
            <BillRow key={item.id} item={item} payer={nameOf(item.paidBy)} peopleCount={doc.people.length} onClick={() => openBill(item.id)} />
          ))}
          <button
            type="button"
            onClick={() => openBill(null)}
            className="flex h-[54px] w-full items-center gap-2 border-t border-line text-left text-[15px] font-bold text-green-ink"
          >
            <PlusIcon />
            {t.home.addBill}
          </button>
        </section>
      ) : (
        <section className={`${card} flex flex-col gap-[14px] p-4`}>
          <span className="text-[17px] font-extrabold">{t.home.bills}</span>
          <button
            type="button"
            onClick={() => openBill(null)}
            className="flex h-[120px] flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-[#9fcbb2] bg-[#f6faf7] text-green-soft-ink dark:border-[#2f6b4b] dark:bg-[#132a20]"
          >
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-green text-white">
              <PlusIcon size={20} />
            </span>
            <span className="text-[16px] font-bold">{t.home.firstBill}</span>
            <span className="text-[13px] text-muted">{t.home.firstBillHint}</span>
          </button>
        </section>
      )}

      </div>

      {desktop ? (
        <aside className="sticky top-6 flex flex-col-reverse gap-[14px]">
          {hasBills && draft ? <ReceiptPanel draft={draft} /> : <ReceiptPlaceholder label={t.home.step3Desc} />}
        </aside>
      ) : null}

      <div className="sticky bottom-[max(16px,env(safe-area-inset-bottom))] mt-auto pt-2 md:hidden">
        {hasBills ? (
          <div className="flex items-center justify-between rounded-[20px] border border-bar-border bg-bar py-[14px] pr-[14px] pl-[18px] text-bar-ink">
            <div>
              <div className="text-[12px] text-bar-muted">{fmt(t.home.totalPeople, { count: doc.people.length })}</div>
              <div className="tabular text-[22px] font-extrabold">{money(total)}</div>
            </div>
            <Link href="/receipt" className="flex h-[50px] items-center gap-2 rounded-[14px] bg-green px-[18px] text-[15px] font-bold text-white no-underline">
              {t.home.seeReceipt}
              <ArrowRightIcon />
            </Link>
          </div>
        ) : (
          <div className={`${card} flex items-center justify-between px-4 py-[14px]`}>
            <div>
              <div className="text-[12px] text-muted">{t.home.total}</div>
              <div className="text-[20px] font-extrabold text-faint">{money(0)}</div>
            </div>
            <button type="button" disabled className="h-12 rounded-[14px] bg-disabled px-[18px] text-[15px] font-bold text-disabled-ink">
              {t.home.seeReceipt}
            </button>
          </div>
        )}
      </div>
      </div>
      {sheets}
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
  const text = "text-[24px] font-extrabold tracking-[-0.02em] md:text-[32px]";
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
        className={`${text} mx-1 w-auto border-b-2 border-green bg-transparent text-ink outline-none`}
      />
    );
  }
  return (
    <button type="button" onClick={() => setValue(title)} aria-label={t.home.editTitle} className={`${text} flex items-center gap-2 self-start px-1 text-left text-ink`}>
      {title}
      <PencilIcon className="shrink-0 text-faint" />
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

function AddPersonChip({ onAdd, tall }: { onAdd: (text: string) => void; tall: boolean }) {
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
    <label className={`inline-flex items-center rounded-full border-[1.5px] border-dashed border-dash px-3 ${tall ? "h-10 px-[14px]" : "h-9"}`}>
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

function EmptyStart({ onAdd }: { onAdd: (text: string) => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(value);
    setValue("");
  };
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-[14px] bg-bg px-4 pt-[14px] pb-[22px] text-ink md:max-w-[1080px] md:px-6 xl:px-8 md:pt-6 md:pb-10">
      <Header />
      <div className="flex flex-1 flex-col gap-[14px] md:grid md:grid-cols-[minmax(0,1fr)_350px] xl:grid-cols-[minmax(0,1fr)_390px] md:items-start md:gap-6 xl:gap-10 md:pt-10">
      <div className="flex flex-col gap-[14px] md:gap-5">
      <h1 className="m-0 px-1 pt-1.5 text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em] whitespace-pre-line md:text-[40px] xl:text-[48px] md:leading-[1.05] md:tracking-[-0.03em]">{t.home.headline}</h1>

      <section className={`${card} flex flex-col gap-3 p-4`}>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-[26px] items-center justify-center rounded-full bg-green text-[13px] font-extrabold text-white">1</span>
          <span className="text-[17px] font-extrabold">{t.home.step1}</span>
        </div>
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
        <div className="text-[13px] text-muted">{t.home.step1Hint}</div>
      </section>

      <div className="flex flex-col gap-[14px] md:grid md:grid-cols-2">
        <StepCard n={2} title={t.home.step2} desc={t.home.step2Desc} />
        <StepCard n={3} title={t.home.step3} desc={t.home.step3Desc} />
      </div>
      </div>
      <aside className="hidden md:block">
        <ReceiptPlaceholder label={t.home.step3Desc} />
      </aside>
      </div>

      <div className="mt-auto text-center text-[12px] text-muted">{t.home.expiryNote}</div>
    </div>
  );
}

function StepCard({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <section className={`${card} flex flex-col gap-2.5 p-4 opacity-55`}>
      <div className="flex items-center gap-2.5">
        <span className="inline-flex size-[26px] items-center justify-center rounded-full bg-disabled text-[13px] font-extrabold text-muted">{n}</span>
        <span className="text-[17px] font-extrabold">{title}</span>
      </div>
      <div className="text-[14px] text-muted">{desc}</div>
    </section>
  );
}

export type { Person };
