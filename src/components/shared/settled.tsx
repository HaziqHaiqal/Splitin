"use client";

import { useRouter } from "next/navigation";
import { PrinterPage } from "@/components/receipt/printer";
import { Receipt } from "@/components/receipt/receipt";
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
  const { t, date } = useI18n();
  const router = useRouter();

  const newSplit = () => {
    saveDraft(null);
    router.push("/");
  };

  const words = (
    <>
      <h1 className="m-0 text-[30px] leading-[1.08] font-extrabold tracking-[-0.03em] md:mt-10 md:text-[44px]">
        {t.settled.title}
      </h1>
      <p className="m-0 text-[14.5px] text-muted">
        {fmt(t.settled.subtitle, { count: summary.done.length, title: bill.doc.title })}
      </p>
    </>
  );
  const actions = (
    <>
      <button
        type="button"
        onClick={newSplit}
        className="h-12 w-full rounded-xl bg-green px-6 text-[15px] font-bold text-white md:w-auto md:self-start"
      >
        {t.settled.newSplit}
      </button>
      <button type="button" onClick={onReview} className="h-9 text-[13.5px] font-bold text-green-ink md:self-start">
        {t.settled.review}
      </button>
    </>
  );
  const deletes = (
    <p className="m-0 text-[12.5px] text-muted">
      {fmt(t.settled.deletesOn, {
        date: date(bill.expiresAt, { day: "2-digit", month: "2-digit", year: "numeric" }),
      })}
    </p>
  );

  return (
    <PrinterPage
      side={
        <>
          {words}
          {actions}
          {deletes}
        </>
      }
      paper={
        <Receipt
          doc={bill.doc}
          payments={bill.payments}
          billId={bill.id}
          expiresAt={bill.expiresAt}
          bigStamp={t.settled.stamp}
        />
      }
      phoneBelow={
        <div className="flex flex-col items-center gap-2 px-5 pt-8 text-center">
          {words}
          <div className="mt-4 flex w-full flex-col items-center gap-1">{actions}</div>
          {deletes}
        </div>
      }
    />
  );
}
