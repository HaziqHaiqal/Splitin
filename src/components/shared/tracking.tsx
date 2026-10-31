"use client";

import { useState, useTransition } from "react";
import { addPayment, removePayment } from "@/app/actions";
import { PrinterPage } from "@/components/receipt/printer";
import { Receipt } from "@/components/receipt/receipt";
import { useToast } from "@/components/toast";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { BillSummary, PlanLine } from "@/lib/bill";
import { cn } from "@/lib/utils";
import { OwnerGreeting } from "./greeting";
import { ChangesBanner, HistoryButton, useChangesSinceVisit } from "./history";
import { OwnerActions } from "./owner-actions";
import { PayForm } from "./pay-form";
import type { SharedBillData } from "./shared-bill";

export function Tracking({
  bill,
  summary,
  ownerToken,
  onViewReceipt,
}: {
  bill: SharedBillData;
  summary: BillSummary;
  ownerToken: string;
  onViewReceipt: () => void;
}) {
  const { t, money, time } = useI18n();
  const toast = useToast();
  const desktop = useIsDesktop();
  const [pending, start] = useTransition();
  const [paying, setPaying] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const changes = useChangesSinceVisit(bill.id, bill.createdAt, bill.events, (e) => e.actor === "owner");
  const showHistory = (next: boolean) => {
    if (next) changes.clear();
    setHistoryOpen(next);
  };
  const nameOf = (id: string) => bill.doc.people.find((p) => p.id === id)?.name ?? "?";

  const paid = summary.done.reduce((s, l) => s + l.amount, 0);
  const all = paid + summary.remaining.reduce((s, l) => s + l.amount, 0);
  const count = summary.done.length + summary.remaining.length;
  const url = typeof window !== "undefined" ? `${window.location.origin}/bill/${bill.id}` : "";

  const pay = (payment: { from: string; to: string; amountMinor: number }) =>
    start(async () => {
      const result = await addPayment(bill.id, payment, { ownerToken });
      if (!result.ok) return void toast({ message: t.common.generic });
      setPaying(false);
      toast({
        message: fmt(t.friend.marked, { name: nameOf(payment.to) }),
        action: { label: t.common.undo, onClick: () => void removePayment(bill.id, result.data.id, { ownerToken }) },
      });
    });

  const markPaid = (line: PlanLine) => pay({ from: line.from, to: line.to, amountMinor: line.amount });

  const markedBy = (line: PlanLine) => {
    if (line.markedBy === "owner") return fmt(t.track.youMarked, { time: time(line.paidAt!) });
    const by = bill.events.find((e) => e.kind === "paid" && e.paymentId === line.paymentId)?.by;
    return by
      ? fmt(t.track.tappedPaid, { name: by, time: time(line.paidAt!) })
      : fmt(t.track.markedPaid, { time: time(line.paidAt!) });
  };

  const markUnpaid = (line: PlanLine) =>
    start(async () => {
      const result = await removePayment(bill.id, line.paymentId!, { ownerToken });
      toast({
        message: result.ok ? fmt(t.track.unmarked, { from: nameOf(line.from), to: nameOf(line.to) }) : t.common.generic,
      });
    });

  const remind = (line: PlanLine) => {
    const text = `${fmt(t.track.remindMessage, { from: nameOf(line.from), title: bill.doc.title, to: nameOf(line.to), amount: money(line.amount) })} ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const rows = [...summary.done.map((l) => ({ l, done: true })), ...summary.remaining.map((l) => ({ l, done: false }))];

  const payForm = (bare: boolean) => (
    <PayForm
      doc={bill.doc}
      bare={bare}
      autoFocus={desktop}
      pending={pending}
      onSave={pay}
      onCancel={() => setPaying(false)}
    />
  );

  const side = (
    <>
      <OwnerGreeting doc={bill.doc} />
      <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">{bill.doc.title}</h1>
      <ChangesBanner count={changes.count} onShow={() => showHistory(true)} />
      <div>
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="text-muted">
            {t.track.paidLabel} · {fmt(t.track.progress, { done: summary.done.length, total: count })}
          </span>
          <b className="tabular">
            {money(paid)}{" "}
            <span className="font-semibold text-muted">
              {t.track.of} {money(all)}
            </span>
          </b>
        </div>
        <div className="mt-2 h-[7px] rounded bg-chip">
          <div
            className="h-[7px] rounded bg-green transition-[width]"
            style={{ width: `${all ? Math.round((paid / all) * 100) : 0}%` }}
          />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card px-4">
        {rows.map(({ l, done }, i) => (
          <div key={done ? l.paymentId : `${l.from}-${l.to}`} className={cn("py-3.5", i > 0 && "border-t border-line")}>
            <div className="flex items-center gap-2.5">
              <div className="min-w-0 flex-1">
                <b className="block text-[15px]">
                  {nameOf(l.from)} → {nameOf(l.to)}
                </b>
                <span className="mt-0.5 block text-[12px] text-muted">{done ? markedBy(l) : t.track.waiting}</span>
              </div>
              <span className="relative text-[15px] font-extrabold tabular">
                <span className={cn(done && "text-faint line-through")}>{money(l.amount)}</span>
                {done ? (
                  <span
                    className="absolute top-1/2 right-[calc(100%-12px)] border-[2.5px] border-stamp bg-card/70 px-1.5 font-mono text-[14px] font-bold tracking-[0.12em] text-stamp"
                    style={{ transform: `translateY(-62%) rotate(${i % 2 ? 6 : -10}deg)` }}
                  >
                    {t.receipt.paidStamp}
                  </span>
                ) : null}
              </span>
            </div>
            {done ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => markUnpaid(l)}
                className="mt-3 h-[38px] rounded-xl bg-chip px-4 text-[13px] font-bold text-ink disabled:opacity-60"
              >
                {t.track.markUnpaid}
              </button>
            ) : (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => remind(l)}
                  className="h-[42px] flex-1 rounded-xl bg-chip text-[14px] font-bold text-ink"
                >
                  {fmt(t.track.remind, { name: nameOf(l.from) })}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => markPaid(l)}
                  className="h-[42px] flex-1 rounded-xl bg-green-soft text-[14px] font-bold text-green-soft-ink disabled:opacity-70"
                >
                  {t.track.markPaid}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {desktop && paying ? payForm(false) : null}
      <div className="flex flex-wrap items-center gap-x-4">
        <HistoryButton doc={bill.doc} events={bill.events} open={historyOpen} onOpenChange={showHistory} />
        <OwnerActions bill={bill} ownerToken={ownerToken} onRecord={() => setPaying(true)} />
      </div>
    </>
  );

  return (
    <PrinterPage
      phoneSide
      side={side}
      paper={<Receipt doc={bill.doc} payments={bill.payments} billId={bill.id} expiresAt={bill.expiresAt} />}
      panel={!desktop && paying ? payForm(true) : undefined}
      dock={
        <button
          type="button"
          onClick={onViewReceipt}
          className="h-12 w-full rounded-xl bg-chip text-[15px] font-bold text-ink"
        >
          {t.track.viewReceipt}
        </button>
      }
    />
  );
}
