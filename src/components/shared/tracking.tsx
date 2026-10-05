"use client";

import Link from "next/link";
import { useTransition } from "react";
import { addPayment, removePayment } from "@/app/actions";
import { Header } from "@/components/header";
import { Receipt } from "@/components/receipt/receipt";
import { useToast } from "@/components/toast";
import { fmt, intlLocale } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { BillSummary, PlanLine } from "@/lib/bill";
import { useDraft } from "@/lib/store";
import type { SharedBillData } from "./shared-bill";
import { Stamp } from "./stamp";

const card = "rounded-[20px] bg-card shadow-[0_1px_2px_rgba(28,31,29,0.06)]";

function relative(iso: string, locale: "en" | "ms") {
  const days = Math.round((new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  return rtf.format(days, "day");
}

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
  const { t, money, locale, date } = useI18n();
  const toast = useToast();
  const draft = useDraft();
  const [pending, start] = useTransition();
  const nameOf = (id: string) => bill.doc.people.find((p) => p.id === id)?.name ?? "?";

  const settled = summary.done.reduce((s, l) => s + l.amount, 0);
  const owing = summary.remaining.reduce((s, l) => s + l.amount, 0);
  const totalToSettle = settled + owing;
  const lines = summary.done.length + summary.remaining.length;
  const url = typeof window !== "undefined" ? `${window.location.origin}/bill/${bill.id}` : "";
  const time = (iso: string) => date(iso, { hour: "numeric", minute: "2-digit" });

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
      toast({ message: result.ok ? fmt(t.track.unmarked, { from: nameOf(line.from), to: nameOf(line.to) }) : t.common.generic });
    });

  const remind = (line: PlanLine) => {
    const text = `${fmt(t.track.remindMessage, { from: nameOf(line.from), title: bill.doc.title, to: nameOf(line.to), amount: money(line.amount) })} ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-[14px] bg-bg px-4 pb-[22px] text-ink md:max-w-[980px] md:px-6 xl:px-8 md:pb-10">
      <Header theme={false} />
      <div className="flex flex-1 flex-col gap-[14px] md:grid md:grid-cols-[minmax(0,1fr)_350px] xl:grid-cols-[minmax(0,1fr)_390px] md:items-start md:gap-6 xl:gap-10 md:pt-6">
      <div className="flex flex-1 flex-col gap-[14px]">
      <div className="px-1">
        <div className="text-[24px] font-extrabold tracking-[-0.02em]">{bill.doc.title}</div>
        <div className="mt-0.5 text-[14px] text-muted">
          {fmt(t.track.shared, { ago: relative(bill.createdAt, locale), done: summary.done.length, total: lines })}
        </div>
      </div>

      <div className={`${card} flex flex-col gap-2 p-4`}>
        <div className="flex justify-between text-[14px]">
          <span className="text-muted">{t.track.settled}</span>
          <span className="tabular font-extrabold">
            {money(settled)}{" "}
            <span className="font-semibold text-muted">
              {t.track.of} {money(totalToSettle).replace("RM ", "")}
            </span>
          </span>
        </div>
        <div className="h-2 rounded bg-line">
          <div className="h-2 rounded bg-green" style={{ width: `${totalToSettle ? Math.round((settled / totalToSettle) * 100) : 0}%` }} />
        </div>
      </div>

      <div className={`${card} px-4 py-1`}>
        {summary.done.map((l, i) => (
          <div key={l.paymentId} className={i > 0 ? "border-t border-line" : ""}>
            <div className="relative flex min-h-[76px] items-center gap-2.5">
              <div className="flex-1">
                <div className="text-[15px] font-bold">
                  {nameOf(l.from)} → {nameOf(l.to)}
                </div>
                <div className="mt-0.5 text-[12px] text-muted">
                  {l.markedBy === "owner" ? fmt(t.track.youMarked, { time: time(l.paidAt!) }) : fmt(t.track.tappedPaid, { name: nameOf(l.from), time: time(l.paidAt!) })}
                </div>
              </div>
              <span className="tabular text-[15px] font-extrabold text-faint line-through">{money(l.amount)}</span>
              <Stamp rotate={i % 2 ? 6 : -10} className="absolute top-[18px] right-[70px] bg-card/70">
                {t.receipt.paidStamp}
              </Stamp>
            </div>
            {/* a friend can mark a payment by mistake (or untruthfully); the owner can always take it back */}
            <div className="pb-[14px]">
              <button type="button" disabled={pending} onClick={() => markUnpaid(l)} className="h-[38px] rounded-xl bg-chip px-4 text-[13px] font-bold text-ink disabled:opacity-60">
                {t.track.markUnpaid}
              </button>
            </div>
          </div>
        ))}
        {summary.remaining.map((l, i) => (
          <div key={`${l.from}-${l.to}`} className={summary.done.length + i > 0 ? "border-t border-line" : ""}>
            <div className="flex min-h-[76px] items-center gap-2.5">
              <div className="flex-1">
                <div className="text-[15px] font-bold">
                  {nameOf(l.from)} → {nameOf(l.to)}
                </div>
                <div className="mt-0.5 text-[12px] text-muted">{t.track.waiting}</div>
              </div>
              <span className="tabular text-[15px] font-extrabold">{money(l.amount)}</span>
            </div>
            <div className="flex gap-2 pb-[14px]">
              <button type="button" onClick={() => remind(l)} className="h-[42px] flex-1 rounded-xl bg-chip text-[14px] font-bold text-ink">
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
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2.5">
        {draft?.billId === bill.id ? (
          <Link href="/" className="text-center text-[14px] font-bold text-green-ink no-underline">
            {t.track.editBills}
          </Link>
        ) : null}
        <button type="button" onClick={onViewReceipt} className="h-[52px] rounded-2xl border border-[#d9ddd8] bg-card text-[15px] font-bold text-ink md:hidden dark:border-border">
          {t.track.viewReceipt}
        </button>
      </div>

      </div>
      <div className="hidden md:sticky md:top-[88px] md:block">
        <Receipt doc={bill.doc} payments={bill.payments} billId={bill.id} expiresAt={bill.expiresAt} />
      </div>
      </div>
    </div>
  );
}
