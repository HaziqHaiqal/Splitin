"use client";

import Link from "next/link";
import { useTransition } from "react";
import { addPayment, removePayment } from "@/app/actions";
import { PrinterPage } from "@/components/receipt/printer";
import { Receipt } from "@/components/receipt/receipt";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { BillSummary, PlanLine } from "@/lib/bill";
import { useDraft } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { SharedBillData } from "./shared-bill";

/**
 * The owner's view of a shared link: how much has been paid, and every payment with Remind / Mark paid, or Mark
 * unpaid once someone has marked it (a friend can mark by mistake). The printer shows the receipt with its PAID
 * stamps. On a phone the payments come first and the receipt is one tap away.
 */
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
  const draft = useDraft();
  const [pending, start] = useTransition();
  const nameOf = (id: string) => bill.doc.people.find((p) => p.id === id)?.name ?? "?";

  const paid = summary.done.reduce((s, l) => s + l.amount, 0);
  const all = paid + summary.remaining.reduce((s, l) => s + l.amount, 0);
  const count = summary.done.length + summary.remaining.length;
  const url = typeof window !== "undefined" ? `${window.location.origin}/bill/${bill.id}` : "";

  const markPaid = (line: PlanLine) =>
    start(async () => {
      const result = await addPayment(bill.id, { from: line.from, to: line.to, amountMinor: line.amount }, ownerToken);
      if (!result.ok) return void toast({ message: t.common.generic });
      toast({
        message: fmt(t.friend.marked, { name: nameOf(line.to) }),
        action: { label: t.common.undo, onClick: () => void removePayment(bill.id, result.data.id, ownerToken) },
      });
    });

  const markUnpaid = (line: PlanLine) =>
    start(async () => {
      const result = await removePayment(bill.id, line.paymentId!, ownerToken);
      toast({
        message: result.ok ? fmt(t.track.unmarked, { from: nameOf(line.from), to: nameOf(line.to) }) : t.common.generic,
      });
    });

  const remind = (line: PlanLine) => {
    const text = `${fmt(t.track.remindMessage, { from: nameOf(line.from), title: bill.doc.title, to: nameOf(line.to), amount: money(line.amount) })} ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const small = "h-[34px] shrink-0 rounded-lg px-3 text-[12.5px] font-bold disabled:opacity-60";
  const rows = [...summary.done.map((l) => ({ l, done: true })), ...summary.remaining.map((l) => ({ l, done: false }))];

  const side = (
    <>
      <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.025em]">{bill.doc.title}</h1>
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
          <div
            key={done ? l.paymentId : `${l.from}-${l.to}`}
            className={cn(
              "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3",
              i > 0 && "border-t border-line",
            )}
          >
            <span className="min-w-0">
              <b className="flex items-center gap-2 text-[14.5px]">
                {nameOf(l.from)} → {nameOf(l.to)}
                {done ? (
                  <span className="inline-flex h-[18px] items-center rounded-full bg-green-soft px-1.5 text-[10px] font-bold tracking-[0.04em] text-green-soft-ink">
                    {t.track.paidPill}
                  </span>
                ) : null}
              </b>
              <span className="block text-[12px] text-muted">
                {done
                  ? l.markedBy === "owner"
                    ? fmt(t.track.youMarked, { time: time(l.paidAt!) })
                    : fmt(t.track.tappedPaid, { name: nameOf(l.from), time: time(l.paidAt!) })
                  : fmt(t.track.waitingAmount, { amount: money(l.amount) })}
              </span>
            </span>
            {done ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => markUnpaid(l)}
                className={cn(small, "border border-border bg-card text-ink")}
              >
                {t.track.markUnpaid}
              </button>
            ) : (
              <span className="flex gap-1.5">
                <button type="button" onClick={() => remind(l)} className={cn(small, "bg-chip text-ink")}>
                  {fmt(t.track.remind, { name: nameOf(l.from) })}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => markPaid(l)}
                  className={cn(small, "bg-green text-white")}
                >
                  {t.track.markPaid}
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
      {draft?.billId === bill.id ? (
        <Link href="/" className="text-[14px] font-bold text-green-ink no-underline">
          {t.track.editBills}
        </Link>
      ) : null}
    </>
  );

  return (
    <PrinterPage
      phoneSide
      side={side}
      paper={<Receipt doc={bill.doc} payments={bill.payments} billId={bill.id} expiresAt={bill.expiresAt} />}
      dock={
        <button
          type="button"
          onClick={onViewReceipt}
          className="h-12 w-full rounded-xl border border-border bg-card text-[15px] font-bold text-ink shadow-[0_4px_14px_rgba(55,53,47,0.10)]"
        >
          {t.track.viewReceipt}
        </button>
      }
    />
  );
}
