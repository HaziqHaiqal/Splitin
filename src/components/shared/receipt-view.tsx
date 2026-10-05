"use client";

import { useState, useTransition } from "react";
import { addPayment, removePayment } from "@/app/actions";
import { Header, TopBar } from "@/components/header";
import { CheckIcon } from "@/components/icons";
import { Receipt } from "@/components/receipt/receipt";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { summarize, type BillSummary, type PlanLine } from "@/lib/bill";
import { setMe, useMe } from "@/lib/store";
import type { SharedBillData } from "./shared-bill";

/**
 * A shared bill's receipt. Friends land here, with one small "I've paid" button under it; the owner
 * opens it from their tracking page (with a way back, and no button: they mark from that page).
 */
export function ReceiptView({ bill, sharedBy, back }: { bill: SharedBillData; sharedBy: string; back?: { label: string; onClick: () => void } }) {
  const { t } = useI18n();
  const [payOpen, setPayOpen] = useState(false);
  const summary = summarize(bill.doc, bill.payments);
  const canPay = !back && summary.remaining.length > 0;
  return (
    <div data-paper className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col bg-paper-bg px-5 pb-8 text-ink">
      {back ? <TopBar back={back} title={t.receipt.title} /> : <Header theme={false} />}
      <Receipt doc={bill.doc} payments={bill.payments} billId={bill.id} expiresAt={bill.expiresAt} sharedBy={sharedBy} />
      {canPay ? (
        <>
          <div className="sticky bottom-[max(16px,env(safe-area-inset-bottom))] mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setPayOpen(true)}
              className="flex h-12 items-center gap-2 rounded-full bg-green px-6 text-[15px] font-bold text-white shadow-[0_6px_18px_rgba(0,0,0,0.25)]"
            >
              <CheckIcon size={16} />
              {t.friend.paidButton}
            </button>
          </div>
          <PaySheet bill={bill} summary={summary} open={payOpen} onOpenChange={setPayOpen} />
        </>
      ) : null}
    </div>
  );
}

/** "Who are you?" (only people who still owe), then that person's open payments, each with a Paid button. */
function PaySheet({ bill, summary, open, onOpenChange }: { bill: SharedBillData; summary: BillSummary; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, money } = useI18n();
  const toast = useToast();
  const me = useMe(bill.id);
  const [pending, start] = useTransition();
  const nameOf = (id: string) => bill.doc.people.find((p) => p.id === id)?.name ?? "?";

  const owers = bill.doc.people.filter((p) => summary.remaining.some((l) => l.from === p.id));
  const mine = me ? summary.remaining.filter((l) => l.from === me) : [];
  const chosen = me && mine.length > 0 ? me : null;

  const mark = (line: PlanLine) =>
    start(async () => {
      const result = await addPayment(bill.id, { from: line.from, to: line.to, amountMinor: line.amount });
      if (!result.ok) return void toast({ message: t.common.generic });
      if (mine.length <= 1) onOpenChange(false);
      toast({
        message: fmt(t.friend.marked, { name: nameOf(line.to) }),
        action: { label: t.common.undo, onClick: () => void removePayment(bill.id, result.data.id) },
      });
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={chosen ? fmt(t.friend.markTitle, { name: nameOf(chosen) }) : t.friend.whoTitle}>
      {chosen ? (
        <div className="flex flex-col">
          {mine.map((l) => (
            <div key={`${l.from}-${l.to}`} className="flex min-h-16 items-center justify-between gap-3 border-t border-line">
              <span className="text-[15px] font-bold">{fmt(t.friend.payTo, { name: nameOf(l.to) })}</span>
              <span className="flex items-center gap-3">
                <span className="tabular text-[16px] font-extrabold">{money(l.amount)}</span>
                <button type="button" disabled={pending} onClick={() => mark(l)} className="h-10 rounded-xl bg-green px-4 text-[14px] font-bold text-white disabled:opacity-60">
                  {t.friend.markOne}
                </button>
              </span>
            </div>
          ))}
          <button type="button" onClick={() => setMe(bill.id, null)} className="mt-2 h-10 self-start text-[14px] font-bold text-green-ink">
            {fmt(t.friend.notYou, { name: nameOf(chosen) })}
          </button>
        </div>
      ) : (
        <>
          <p className="m-0 -mt-1 text-[14px] text-muted">{t.friend.whoDesc}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {owers.map((p) => {
              const owed = summary.remaining.filter((l) => l.from === p.id).reduce((s, l) => s + l.amount, 0);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setMe(bill.id, p.id)}
                  className="h-[74px] rounded-2xl border-[1.5px] border-border bg-field px-[14px] text-left text-ink hover:border-green"
                >
                  <span className="block truncate text-[16px] font-extrabold">{p.name}</span>
                  <span className="mt-0.5 block text-[13px] font-semibold text-owe">{fmt(t.friend.owes, { amount: money(owed) })}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Sheet>
  );
}
