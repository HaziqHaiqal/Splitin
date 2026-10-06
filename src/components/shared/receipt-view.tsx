"use client";

import { useState, useTransition } from "react";
import { addPayment, removePayment } from "@/app/actions";
import { TopBar } from "@/components/header";
import { PrinterPage } from "@/components/receipt/printer";
import { Receipt } from "@/components/receipt/receipt";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { summarize, type PlanLine } from "@/lib/bill";
import type { SharedBillData } from "./shared-bill";

/**
 * A shared bill's receipt in the printer. Friends land here and tap their payment on the paper to mark it paid;
 * on desktop the left side explains that and lists who to pay, with Copy for each account number.
 * The owner opens it from their payments list on a phone (with a way back) and marks payments there instead.
 */
export function ReceiptView({
  bill,
  sharedBy,
  back,
}: {
  bill: SharedBillData;
  sharedBy: string;
  back?: { label: string; onClick: () => void };
}) {
  const { t, money, date } = useI18n();
  const toast = useToast();
  const [line, setLine] = useState<PlanLine | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const nameOf = (id: string) => bill.doc.people.find((p) => p.id === id)?.name ?? "?";
  const friend = !back;
  const summary = summarize(bill.doc, bill.payments);

  // people who get paid and have bank details, for the "Pay to" card
  const receivers = [...new Set([...summary.remaining, ...summary.done].map((l) => l.to))]
    .map((id) => bill.doc.people.find((p) => p.id === id))
    .filter((p) => p?.bank && p.accountNo);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text.replace(/\s+/g, ""));
      toast({ message: t.common.copied });
    } catch {
      toast({ message: t.common.generic });
    }
  };

  const confirm = () => {
    if (!line) return;
    const l = line;
    start(async () => {
      const result = await addPayment(bill.id, { from: l.from, to: l.to, amountMinor: l.amount });
      setOpen(false);
      if (!result.ok) return void toast({ message: t.common.generic });
      toast({
        message: fmt(t.friend.marked, { name: nameOf(l.to) }),
        action: { label: t.common.undo, onClick: () => void removePayment(bill.id, result.data.id) },
      });
    });
  };

  const side = (
    <>
      <span className="text-[11px] font-bold tracking-[0.06em] text-faint uppercase">
        {fmt(t.friend.sharedLine, {
          name: sharedBy,
          date: date(bill.createdAt, { day: "numeric", month: "short" }),
        })}
      </span>
      <h1 className="m-0 text-[30px] font-extrabold tracking-[-0.025em]">{bill.doc.title}</h1>
      {friend && summary.remaining.length > 0 ? (
        <p className="m-0 max-w-[46ch] text-[14.5px] leading-[1.5] text-muted">{t.friend.findYours}</p>
      ) : null}
      {receivers.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card px-4 pt-3 pb-1">
          <span className="text-[11px] font-bold tracking-[0.06em] text-faint uppercase">{t.friend.payTo}</span>
          {receivers.map((p, i) => (
            <div
              key={p!.id}
              className={`flex items-center justify-between gap-3 py-3 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <span className="min-w-0">
                <b className="block text-[14.5px]">{p!.name}</b>
                <span className="block text-[13px] text-muted">
                  {p!.bank} · <span className="tabular">{p!.accountNo}</span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => copy(p!.accountNo!)}
                className="h-[34px] shrink-0 rounded-lg border border-border bg-card px-3 text-[13px] font-bold text-ink"
              >
                {t.common.copy}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <PrinterPage
        header={back ? <TopBar back={back} title={t.receipt.title} /> : undefined}
        side={side}
        paper={
          <Receipt
            doc={bill.doc}
            payments={bill.payments}
            billId={bill.id}
            expiresAt={bill.expiresAt}
            sharedBy={sharedBy}
            hint={friend && summary.remaining.length > 0 ? t.friend.tapHint : undefined}
            onLine={
              friend
                ? (l) => {
                    setLine(l);
                    setOpen(true);
                  }
                : undefined
            }
          />
        }
      />
      {friend ? (
        <Sheet
          open={open}
          onOpenChange={setOpen}
          title={line ? fmt(t.friend.confirmTitle, { from: nameOf(line.from), to: nameOf(line.to) }) : ""}
        >
          <div className="text-[30px] font-extrabold tracking-[-0.02em] tabular">{line ? money(line.amount) : ""}</div>
          <p className="m-0 text-[14px] text-muted">{t.friend.confirmDesc}</p>
          <div className="flex flex-col gap-1.5 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={confirm}
              className="h-14 rounded-2xl bg-green text-[16px] font-bold text-white disabled:opacity-60"
            >
              {t.track.markPaid}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-11 text-[15px] font-bold text-muted">
              {t.friend.cancel}
            </button>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
