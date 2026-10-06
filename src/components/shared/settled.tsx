"use client";

import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Zigzag } from "@/components/receipt/receipt";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { BillSummary } from "@/lib/bill";
import { saveDraft } from "@/lib/store";
import type { SharedBillData } from "./shared-bill";

export function Settled({
  bill,
  summary,
  onReview,
}: {
  bill: SharedBillData;
  summary: BillSummary;
  onReview: () => void;
}) {
  const { t, plain, money, date } = useI18n();
  const router = useRouter();
  const nameOf = (id: string) => bill.doc.people.find((p) => p.id === id)?.name.toUpperCase() ?? "?";

  const newSplit = () => {
    saveDraft(null);
    router.push("/");
  };

  return (
    <div
      data-paper
      className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-4 bg-paper-bg px-5 pb-[22px] text-ink md:max-w-[900px] md:px-6"
    >
      <Header />
      {/* phone: title, receipt, buttons stacked · desktop: text + buttons left, receipt right */}
      <div className="flex flex-1 flex-col gap-4 md:grid md:flex-none md:grid-cols-[minmax(0,1fr)_350px] md:gap-x-12 md:gap-y-8 md:pt-20">
        <div className="px-0.5 md:col-start-1 md:row-start-1 md:self-end">
          <div className="text-[26px] font-extrabold tracking-[-0.02em] md:text-[44px] md:leading-[1.05]">
            {t.settled.title}
          </div>
          <div className="mt-1 text-[14px] text-muted md:mt-3 md:text-[17px]">
            {fmt(t.settled.subtitle, { count: summary.done.length, title: bill.doc.title })}
          </div>
        </div>
        <div
          className="relative md:col-start-2 md:row-span-2 md:row-start-1 md:self-center"
          style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.12))" }}
        >
          <div className="bg-[#fffdf6] p-[18px] font-mono text-[13px] leading-[1.7] text-[#26231f]">
            <div className="text-center font-bold tracking-[0.3em]">SPLITIN</div>
            <div className="my-2 border-t-[1.5px] border-dashed border-[#26231f]" />
            {summary.done.map((l) => (
              <div key={l.paymentId} className="flex justify-between text-[#8a8478] line-through">
                <span>
                  {nameOf(l.from)} → {nameOf(l.to)}
                </span>
                <span>{plain(l.amount)}</span>
              </div>
            ))}
            <div className="my-2 border-t-[1.5px] border-dashed border-[#26231f]" />
            <div className="flex justify-between font-bold">
              <span>{t.settled.balance}</span>
              <span>{money(0)}</span>
            </div>
          </div>
          <Zigzag edge="bottom" />
          <div
            className="absolute top-14 left-16 border-[5px] border-[#c2412b] bg-[rgba(255,253,246,0.6)] px-4 py-0.5 font-mono text-[38px] font-bold tracking-[0.14em] text-[#c2412b]"
            style={{ transform: "rotate(-14deg)" }}
          >
            {t.settled.stamp}
          </div>
        </div>
        <div className="mt-auto flex flex-col gap-2.5 md:col-start-1 md:row-start-2 md:mt-0 md:max-w-[400px] md:self-start">
          <button
            type="button"
            onClick={newSplit}
            className="h-14 rounded-2xl bg-green px-5 text-[16px] font-bold text-white"
          >
            {t.settled.newSplit}
          </button>
          <button type="button" onClick={onReview} className="h-10 text-[14px] font-bold text-green-ink">
            {t.settled.review}
          </button>
          <div className="text-center text-[12px] text-muted md:text-left">
            {fmt(t.settled.deletesOn, {
              date: date(bill.expiresAt, { day: "2-digit", month: "2-digit", year: "numeric" }),
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
