"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "@/components/icons";
import { QrImage } from "@/components/pay-qr";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { Person } from "@/lib/bill";
import { isPaymentQr, readQrDetails } from "@/lib/pay-qr";
import { readQr } from "@/lib/read-qr";

const BANKS = ["Maybank", "CIMB", "Public Bank", "RHB", "Hong Leong", "Bank Islam", "TNG eWallet"];

export function useBankDetails(person: Person | null) {
  const knownBank = person?.bank && BANKS.includes(person.bank) ? person.bank : null;
  const [bank, setBank] = useState<string | null>(knownBank ?? (person?.bank ? "other" : null));
  const [otherBank, setOtherBank] = useState(knownBank ? "" : (person?.bank ?? ""));
  const [accountNo, setAccountNo] = useState(person?.accountNo ?? "");
  const [payQr, setPayQr] = useState(person?.payQr ?? null);
  const bankName = bank === "other" ? otherBank.trim() : bank;
  return { bank, setBank, otherBank, setOtherBank, accountNo, setAccountNo, payQr, setPayQr, bankName };
}

function QrUpload({
  own,
  code,
  onChange,
}: {
  own: boolean;
  code: string | null;
  onChange: (code: string | null) => void;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const details = code ? readQrDetails(code) : null;
  const owner = [details?.name, details?.bank].filter(Boolean).join(" · ");

  const read = async (file: File) => {
    setReading(true);
    setProblem(null);
    try {
      const found = await readQr(file);
      if (!found) setProblem(t.person.qrNotFound);
      else if (!isPaymentQr(found)) setProblem(t.person.qrNotPayment);
      else onChange(found.trim());
    } catch {
      setProblem(t.person.qrNotFound);
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void read(file);
        }}
      />
      {code ? (
        <div className="flex items-center gap-3 rounded-[14px] border border-border p-2.5">
          <QrImage code={code} className="size-16 rounded-lg" />
          <span className="flex min-w-0 flex-col items-start">
            <b className="text-[14.5px] font-bold">{t.person.qrAdded}</b>
            {owner ? <span className="text-[12.5px] leading-[1.35] text-muted">{owner}</span> : null}
            <button type="button" onClick={() => onChange(null)} className="h-8 text-[13px] font-bold text-owe">
              {t.person.qrRemove}
            </button>
          </span>
        </div>
      ) : (
        <button
          type="button"
          disabled={reading}
          onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center gap-0.5 rounded-[14px] border-[1.5px] border-dashed border-raised-edge px-3 py-3 text-center disabled:opacity-60"
        >
          <UploadIcon size={20} className="mb-0.5 text-green-ink" />
          <b className="text-[14.5px] font-bold">{own ? t.person.uploadOwnQr : t.person.uploadQr}</b>
          <span className="text-[12.5px] leading-[1.35] text-muted">{t.person.uploadQrHint}</span>
        </button>
      )}
      {problem ? (
        <p role="alert" className="m-0 text-[13px] font-semibold text-owe">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

export function BankFields({
  name,
  own = false,
  details,
}: {
  name: string;
  own?: boolean;
  details: ReturnType<typeof useBankDetails>;
}) {
  const { t } = useI18n();
  const { bank, setBank, otherBank, setOtherBank, accountNo, setAccountNo, payQr, setPayQr, bankName } = details;

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

      <QrUpload own={own} code={payQr} onChange={setPayQr} />
      <div className="flex items-center gap-2.5 text-[12px] font-semibold text-faint before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        {t.person.orType}
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
      <p className="m-0 text-[12px] leading-[1.4] text-muted">{t.person.detailsNotice}</p>
    </>
  );
}
