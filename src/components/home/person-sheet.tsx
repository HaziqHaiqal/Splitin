"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { BillDoc, Person } from "@/lib/bill";

export const BANKS = ["Maybank", "CIMB", "Public Bank", "RHB", "Hong Leong", "Bank Islam", "TNG eWallet"];

export function PersonSheet({
  open,
  onOpenChange,
  person,
  doc,
  update,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: Person | null;
  doc: BillDoc;
  update: (fn: (doc: BillDoc) => BillDoc) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const knownBank = person?.bank && BANKS.includes(person.bank) ? person.bank : null;
  const [name, setName] = useState(person?.name ?? "");
  const [bank, setBank] = useState<string | null>(knownBank ?? (person?.bank ? "other" : null));
  const [otherBank, setOtherBank] = useState(knownBank ? "" : (person?.bank ?? ""));
  const [accountNo, setAccountNo] = useState(person?.accountNo ?? "");

  if (!person) return null;
  const displayName = name.trim() || person.name;
  const bankName = bank === "other" ? otherBank.trim() : bank;

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    update((d) => ({
      ...d,
      people: d.people.map((p) =>
        p.id === person.id
          ? { ...p, name: trimmed.slice(0, 30), bank: bankName || null, accountNo: bankName ? accountNo.trim() || null : null }
          : p,
      ),
    }));
    onOpenChange(false);
  };

  const remove = () => {
    if (doc.items.some((i) => i.paidBy === person.id)) {
      toast({ message: fmt(t.person.paidABill, { name: person.name }) });
      return;
    }
    update((d) => ({
      ...d,
      people: d.people.filter((p) => p.id !== person.id),
      items: d.items
        .map((i) => {
          const overrides = { ...i.overrides };
          delete overrides[person.id];
          return { ...i, participants: i.participants.filter((id) => id !== person.id), overrides };
        })
        .filter((i) => i.participants.length > 0),
    }));
    onOpenChange(false);
  };

  const chip = (selected: boolean) =>
    selected
      ? "h-9 rounded-full bg-green px-3 text-[13px] font-bold text-white"
      : "h-9 rounded-full bg-chip px-3 text-[13px] font-semibold text-ink";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={<span className="sr-only">{person.name}</span>}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="-mt-[14px] flex flex-col gap-4"
      >
        <div className="flex items-center gap-3">
          <Avatar name={displayName} color={person.color} size={48} />
          <label className="flex-1">
            <span className="sr-only">{t.person.name}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className="h-12 w-full rounded-xl border border-border bg-card px-[14px] text-[18px] font-bold text-ink outline-none focus:border-green"
            />
          </label>
        </div>

        <div className="mt-1 text-[15px] font-extrabold">
          {fmt(t.person.whereToPay, { name: displayName })}{" "}
          <span className="text-[13px] font-medium text-muted">{t.common.optional}</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-muted">{t.person.bankLabel}</span>
          <div className="flex flex-wrap gap-1.5">
            {BANKS.map((b) => (
              <button key={b} type="button" aria-pressed={bank === b} onClick={() => setBank(bank === b ? null : b)} className={chip(bank === b)}>
                {b}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={bank === "other"}
              onClick={() => setBank(bank === "other" ? null : "other")}
              className={bank === "other" ? chip(true) : "h-9 rounded-full border-[1.5px] border-dashed border-dash bg-card px-3 text-[13px] font-bold text-green-ink"}
            >
              {t.person.other}
            </button>
          </div>
          {bank === "other" ? (
            <input
              type="text"
              value={otherBank}
              onChange={(e) => setOtherBank(e.target.value)}
              placeholder={t.person.otherPlaceholder}
              maxLength={40}
              aria-label={t.person.otherPlaceholder}
              className="h-12 rounded-xl border border-border bg-card px-[14px] text-[16px] font-semibold text-ink outline-none focus:border-green"
            />
          ) : null}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-muted">{t.person.accountLabel}</span>
          <input
            type="text"
            inputMode="numeric"
            value={accountNo}
            onChange={(e) => setAccountNo(e.target.value.replace(/[^\d -]/g, ""))}
            disabled={!bankName}
            placeholder={t.person.accountPlaceholder}
            maxLength={40}
            className={
              bankName
                ? "h-[52px] rounded-xl border-[1.5px] border-green bg-card px-[14px] text-[20px] font-bold tracking-[0.04em] text-ink shadow-[0_0_0_4px_var(--green-soft)] outline-none"
                : "h-[52px] cursor-not-allowed rounded-xl border border-border bg-chip px-[14px] text-[16px] font-semibold text-faint outline-none"
            }
          />
        </label>

        <button type="submit" disabled={!name.trim()} className="h-[54px] rounded-2xl bg-green text-[16px] font-bold text-white disabled:bg-disabled disabled:text-disabled-ink">
          {t.common.save}
        </button>
        <button type="button" onClick={remove} className="-mt-1.5 h-10 text-[15px] font-bold text-owe">
          {fmt(t.person.remove, { name: person.name })}
        </button>
      </form>
    </Sheet>
  );
}
