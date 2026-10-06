"use client";

import { useState, useTransition } from "react";
import { addPayment, removePayment } from "@/app/actions";
import { Header, TopBar } from "@/components/header";
import { Receipt } from "@/components/receipt/receipt";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { PlanLine } from "@/lib/bill";
import type { SharedBillData } from "./shared-bill";

/**
 * A shared bill's receipt. Friends land here and tap a payment on it to mark it paid; the owner
 * opens it from their tracking page (with a way back) and marks payments there instead.
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
  const { t, money } = useI18n();
  const toast = useToast();
  const [line, setLine] = useState<PlanLine | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const nameOf = (id: string) => bill.doc.people.find((p) => p.id === id)?.name ?? "?";
  const friend = !back;

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

  return (
    <div data-paper className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col bg-paper-bg px-5 pb-8 text-ink">
      {back ? <TopBar back={back} title={t.receipt.title} /> : <Header />}
      <Receipt
        doc={bill.doc}
        payments={bill.payments}
        billId={bill.id}
        expiresAt={bill.expiresAt}
        sharedBy={sharedBy}
        hint={friend ? t.friend.tapHint : undefined}
        onLine={
          friend
            ? (l) => {
                setLine(l);
                setOpen(true);
              }
            : undefined
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
    </div>
  );
}
