"use client";

import { useState } from "react";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { Person } from "@/lib/bill";

const BANKS = ["Maybank", "CIMB", "Public Bank", "RHB", "Hong Leong", "Bank Islam", "TNG eWallet"];

export function useBankDetails(person: Person | null) {
  const knownBank = person?.bank && BANKS.includes(person.bank) ? person.bank : null;
  const [bank, setBank] = useState<string | null>(knownBank ?? (person?.bank ? "other" : null));
  const [otherBank, setOtherBank] = useState(knownBank ? "" : (person?.bank ?? ""));
  const [accountNo, setAccountNo] = useState(person?.accountNo ?? "");
  const bankName = bank === "other" ? otherBank.trim() : bank;
  return { bank, setBank, otherBank, setOtherBank, accountNo, setAccountNo, bankName };
}

export function BankFields({ name, details }: { name: string; details: ReturnType<typeof useBankDetails> }) {
  const { t } = useI18n();
  const { bank, setBank, otherBank, setOtherBank, accountNo, setAccountNo, bankName } = details;

  const chip = (selected: boolean) =>
    selected
      ? "h-9 rounded-full bg-green px-3 text-[13px] font-bold text-white"
      : "h-9 rounded-full bg-chip px-3 text-[13px] font-semibold text-ink";

  return (
    <>
      <div className="mt-1 text-[15px] font-extrabold">
        {fmt(t.person.whereToPay, { name })}{" "}
        <span className="text-[13px] font-medium text-muted">{t.common.optional}</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-muted">{t.person.bankLabel}</span>
        <div className="flex flex-wrap gap-1.5">
          {BANKS.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={bank === b}
              onClick={() => setBank(bank === b ? null : b)}
              className={chip(bank === b)}
            >
              {b}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={bank === "other"}
            onClick={() => setBank(bank === "other" ? null : "other")}
            className={
              bank === "other"
                ? chip(true)
                : "h-9 rounded-full border-[1.5px] border-dashed border-dash bg-card px-3 text-[13px] font-bold text-green-ink"
            }
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
    </>
  );
}
