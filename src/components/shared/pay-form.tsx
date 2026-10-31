"use client";

import { useState } from "react";
import { PersonChips } from "@/components/home/person-chips";
import { useI18n } from "@/i18n/client";
import type { BillDoc } from "@/lib/bill";
import { parseMoney, toAutoPointInput } from "@/lib/money";
import { fieldClass, PanelForm, SubmitButton } from "./panel-form";

export function PayForm({
  doc,
  from: startFrom,
  to: startTo,
  bare,
  autoFocus,
  pending,
  onSave,
  onCancel,
}: {
  doc: BillDoc;
  from?: string;
  to?: string;
  bare: boolean;
  autoFocus: boolean;
  pending: boolean;
  onSave: (payment: { from: string; to: string; amountMinor: number }) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [from, setFrom] = useState(startFrom ?? "");
  const [to, setTo] = useState(startTo ?? "");
  const [amount, setAmount] = useState("");
  const amountMinor = parseMoney(amount, "MYR") ?? 0;
  const ready = Boolean(from && to) && from !== to && amountMinor > 0;

  return (
    <PanelForm
      title={t.pay.title}
      bare={bare}
      onCancel={onCancel}
      onSubmit={() => {
        if (ready) onSave({ from, to, amountMinor });
      }}
    >
      <p className="m-0 text-[12.5px] text-muted">{t.pay.desc}</p>
      <div className="flex flex-col gap-1.5">
        <span className="text-[12.5px] text-muted">{t.bill.whoPaid}</span>
        <PersonChips people={doc.people} value={from} onChange={setFrom} bare={bare} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[12.5px] text-muted">{t.pay.to}</span>
        <PersonChips people={doc.people} value={to} onChange={setTo} bare={bare} />
      </div>
      <input
        type="text"
        inputMode="numeric"
        value={amount}
        autoFocus={autoFocus}
        aria-label={t.bill.amount}
        placeholder="0.00"
        onChange={(e) => setAmount(toAutoPointInput(e.target.value, "MYR"))}
        className={`${fieldClass} font-extrabold tabular`}
      />
      <SubmitButton disabled={pending || !ready}>{t.track.markPaid}</SubmitButton>
    </PanelForm>
  );
}
