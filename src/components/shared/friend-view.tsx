"use client";

import Link from "next/link";
import { useTransition } from "react";
import { addPayment, removePayment } from "@/app/actions";
import { Header } from "@/components/header";
import { Receipt } from "@/components/receipt/receipt";
import { useIsDesktop } from "@/components/sheet";
import { CheckIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { BillSummary, PlanLine } from "@/lib/bill";
import { setMe } from "@/lib/store";
import type { SharedBillData } from "./shared-bill";
import { Stamp } from "./stamp";

const card = "rounded-[20px] bg-card shadow-[0_1px_2px_rgba(28,31,29,0.06)]";

function useNames(bill: SharedBillData) {
  return (id: string) => bill.doc.people.find((p) => p.id === id)?.name ?? "?";
}

export function FriendView({ bill, meId, summary, onReceipt }: { bill: SharedBillData; meId: string; summary: BillSummary; onReceipt: () => void }) {
  const { t, money } = useI18n();
  const toast = useToast();
  const [pending, start] = useTransition();
  const desktop = useIsDesktop();
  const nameOf = useNames(bill);
  const me = bill.doc.people.find((p) => p.id === meId)!;

  const remaining = summary.remaining.filter((l) => l.from === meId);
  const done = summary.done.filter((l) => l.from === meId);
  const incoming = [...summary.done.filter((l) => l.to === meId), ...summary.remaining.filter((l) => l.to === meId)];
  const collecting = summary.people.find((p) => p.id === meId)!.net > 0;
  const owed = remaining.reduce((s, l) => s + l.amount, 0);
  const billsCount = bill.doc.items.filter((i) => i.participants.includes(meId)).length;

  const markPaid = (line: PlanLine) =>
    start(async () => {
      const result = await addPayment(bill.id, { from: line.from, to: line.to, amountMinor: line.amount });
      if (!result.ok) {
        toast({ message: t.common.generic });
        return;
      }
      toast({
        message: fmt(t.friend.marked, { name: nameOf(line.to) }),
        action: { label: t.common.undo, onClick: () => void removePayment(bill.id, result.data.id) },
      });
    });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text.replace(/\s+/g, ""));
      toast({ message: t.common.copied });
    } catch {
      toast({ message: t.common.generic });
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-3 bg-bg px-4 pt-[14px] pb-5 text-ink md:max-w-[920px] md:px-6 xl:px-8 md:pt-6 md:pb-10">
      <Header theme={false} />
      <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_350px] xl:grid-cols-[minmax(0,1fr)_390px] md:items-start md:gap-6 xl:gap-10 md:pt-6">
      <div className="flex flex-col gap-3">
      <div className="px-1">
        <div className="text-[13px] text-muted">
          {bill.doc.title} ·{" "}
          <button type="button" onClick={() => setMe(bill.id, null)} className="text-[13px] font-bold text-green-ink">
            {fmt(t.friend.notYou, { name: me.name })}
          </button>
        </div>
        <div className="mt-2 text-[15px] font-semibold">
          {collecting ? fmt(t.friend.youCollect, { name: me.name }) : fmt(done.length > 0 ? t.friend.stillOwe : t.friend.youOwe, { name: me.name })}
        </div>
        <div className="tabular text-[40px] font-extrabold tracking-[-0.03em]">
          {money(collecting ? summary.remaining.filter((l) => l.to === meId).reduce((s, l) => s + l.amount, 0) : owed)}
        </div>
        {!collecting && done.length === 0 ? (
          <div className="text-[13px] text-muted">
            {remaining.length === 1
              ? fmt(t.friend.shareOfOne, { bills: billsCount })
              : fmt(t.friend.shareOf, { bills: billsCount, payments: remaining.length })}
          </div>
        ) : null}
      </div>

      {collecting ? (
        <div className={`${card} px-4 py-1`}>
          {incoming.map((l, i) => {
            const paid = "paymentId" in l && Boolean(l.paymentId);
            return (
              <div key={`${l.from}-${i}`} className={`relative flex min-h-[60px] items-center justify-between ${i > 0 ? "border-t border-line" : ""}`}>
                <div>
                  <div className="text-[15px] font-bold">{fmt(t.friend.from, { name: nameOf(l.from) })}</div>
                  <div className="text-[12px] text-muted">{paid ? t.friend.received : t.track.waiting}</div>
                </div>
                <span className={`tabular text-[15px] font-extrabold ${paid ? "text-faint line-through" : ""}`}>{money(l.amount)}</span>
                {paid ? <Stamp className="absolute top-[18px] right-[80px] bg-card/70 text-[12px]">{t.receipt.paidStamp}</Stamp> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {done.map((l) => (
            <div key={l.paymentId} className={`${card} flex items-center gap-3 px-[14px] py-4`}>
              <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-full bg-green text-white">
                <CheckIcon size={18} />
              </span>
              <div className="flex-1">
                <div className="text-[15px] font-bold">{fmt(t.friend.paidDone, { name: nameOf(l.to), amount: money(l.amount) })}</div>
                <div className="text-[12px] text-muted">{fmt(t.friend.seesIt, { name: nameOf(l.to) })}</div>
              </div>
              <Stamp>{t.receipt.paidStamp}</Stamp>
            </div>
          ))}
          {remaining.map((l, index) => {
            const payee = bill.doc.people.find((p) => p.id === l.to);
            const highlight = done.length > 0 && index === 0;
            return (
              <div key={`${l.from}-${l.to}`} className={`${card} flex flex-col gap-2.5 p-[14px] ${highlight ? "border-2 border-green" : ""}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[16px] font-bold">
                    {highlight ? fmt(t.friend.nextPay, { name: nameOf(l.to) }) : fmt(t.friend.payStep, { n: index + 1, name: nameOf(l.to) })}
                  </span>
                  <span className="tabular text-[20px] font-extrabold">{money(l.amount)}</span>
                </div>
                {payee?.bank && payee.accountNo ? (
                  <div className="flex items-center gap-2.5 rounded-xl bg-field py-2.5 pr-2 pl-3">
                    <div className="flex-1">
                      <div className="text-[12px] text-muted">{payee.bank}</div>
                      <div className="tabular text-[18px] font-extrabold tracking-[0.03em]">{payee.accountNo}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(payee.accountNo!)}
                      className="h-10 rounded-[10px] border border-border bg-card px-[14px] text-[14px] font-bold text-ink"
                    >
                      {t.common.copy}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl bg-field px-3 py-2.5 text-[13px] text-muted">{fmt(t.friend.noBank, { name: nameOf(l.to) })}</div>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => markPaid(l)}
                  className="h-[46px] rounded-xl bg-green text-[15px] font-bold text-white disabled:opacity-70"
                >
                  {fmt(t.friend.iPaid, { name: nameOf(l.to) })}
                </button>
              </div>
            );
          })}
        </>
      )}

      <button type="button" onClick={onReceipt} className="self-center p-2 text-[14px] font-bold text-green-ink md:hidden">
        {t.friend.seeFull}
      </button>
      </div>
      {desktop ? (
        <aside className="sticky top-6">
          <Receipt doc={bill.doc} payments={bill.payments} billId={bill.id} expiresAt={bill.expiresAt} sharedBy={bill.doc.people[0]?.name} />
        </aside>
      ) : null}
      </div>
    </div>
  );
}

export function FriendDone({ bill, meId, done, onReceipt }: { bill: SharedBillData; meId: string; done: PlanLine[]; onReceipt: () => void }) {
  const { t, money, locale } = useI18n();
  const nameOf = useNames(bill);
  const me = bill.doc.people.find((p) => p.id === meId)!;
  const payees = [...new Set(done.map((l) => nameOf(l.to)))];
  const joined = payees.length <= 1 ? payees.join("") : `${payees.slice(0, -1).join(", ")} ${locale === "ms" ? "dan" : "and"} ${payees[payees.length - 1]}`;
  const total = done.reduce((s, l) => s + l.amount, 0);
  const desktop = useIsDesktop();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-4 bg-bg px-4 pt-[14px] pb-[22px] text-ink md:max-w-[920px] md:px-6 md:pt-6 md:pb-10">
      <Header theme={false} />
      <div className="flex flex-1 flex-col gap-4 md:grid md:flex-none md:grid-cols-[minmax(0,1fr)_350px] md:items-start md:gap-10 md:pt-6">
      <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col items-center gap-2.5 px-2.5 pt-10 pb-2.5 text-center">
        <span className="inline-flex size-[72px] items-center justify-center rounded-full bg-green text-white">
          <CheckIcon size={36} strokeWidth={2.6} />
        </span>
        <div className="text-[26px] font-extrabold tracking-[-0.02em]">{fmt(t.friend.allSettled, { name: me.name })}</div>
        {joined ? <div className="text-[15px] text-muted">{fmt(t.friend.allSettledDesc, { names: joined })}</div> : null}
      </div>
      {done.length > 0 ? (
        <div className={`${card} px-4 py-1`}>
          {done.map((l) => (
            <div key={l.paymentId} className="flex min-h-[54px] items-center justify-between border-b border-line text-[15px]">
              <span>{fmt(t.friend.paidTo, { name: nameOf(l.to) })}</span>
              <span className="tabular font-extrabold">{money(l.amount)}</span>
            </div>
          ))}
          <div className="flex min-h-[54px] items-center justify-between text-[15px] font-bold">
            <span>{t.friend.yourTotal}</span>
            <span className="tabular font-extrabold">{money(total)}</span>
          </div>
        </div>
      ) : null}
      <div className="mt-auto flex flex-col gap-2.5 md:mt-2">
        <button type="button" onClick={onReceipt} className="h-[52px] rounded-2xl border border-[#d9ddd8] bg-card text-[15px] font-bold text-ink md:hidden dark:border-border">
          {t.friend.seeFull}
        </button>
        <Link href="/" className="flex h-14 items-center justify-center rounded-2xl bg-green text-[16px] font-bold text-white no-underline">
          {t.friend.splitOwn}
        </Link>
      </div>
      </div>
      {desktop ? (
        <aside className="sticky top-6">
          <Receipt doc={bill.doc} payments={bill.payments} billId={bill.id} expiresAt={bill.expiresAt} sharedBy={bill.doc.people[0]?.name} />
        </aside>
      ) : null}
      </div>
    </div>
  );
}
