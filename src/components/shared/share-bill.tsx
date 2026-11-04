"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ShareIcon } from "@/components/icons";
import { Receipt } from "@/components/receipt/receipt";
import { ShareSheet } from "@/components/receipt/share-sheet";
import { useI18n } from "@/i18n/client";
import { ownerOf } from "@/lib/bill";
import { getShareNext, setShareNext } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { SharedBillData } from "./shared-bill";

export function useShareBill(bill: SharedBillData, bigStamp?: string) {
  const router = useRouter();
  const paper = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(() => typeof window !== "undefined" && getShareNext() === bill.id);

  useEffect(() => {
    if (getShareNext() === bill.id) setShareNext(null);
  }, [bill.id]);

  const show = () => {
    router.refresh();
    setOpen(true);
  };

  const sheet = (
    <>
      {open ? (
        <div inert className="fixed top-0 left-[-9999px] w-[380px]">
          <Receipt
            ref={paper}
            doc={bill.doc}
            payments={bill.payments}
            billId={bill.id}
            expiresAt={bill.expiresAt}
            sharedBy={ownerOf(bill.doc)?.name}
            bigStamp={bigStamp}
          />
        </div>
      ) : null}
      <ShareSheet
        open={open}
        onOpenChange={setOpen}
        billId={bill.id}
        doc={bill.doc}
        payments={bill.payments}
        receiptRef={paper}
      />
    </>
  );

  return { show, sheet };
}

export function ShareBill({
  bill,
  bigStamp,
  label = false,
  className,
}: {
  bill: SharedBillData;
  bigStamp?: string;
  label?: boolean;
  className: string;
}) {
  const { t } = useI18n();
  const share = useShareBill(bill, bigStamp);

  return (
    <>
      <button
        type="button"
        aria-label={t.receipt.share}
        title={t.receipt.share}
        onClick={share.show}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl bg-green font-bold whitespace-nowrap text-white",
          className,
        )}
      >
        <ShareIcon size={18} />
        {label ? t.receipt.share : null}
      </button>
      {share.sheet}
    </>
  );
}

export function ShareCard({ big = false, onClick }: { big?: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center bg-green text-left text-white",
        big ? "gap-4 rounded-2xl px-[18px] py-4" : "gap-3.5 rounded-[13px] px-3.5 py-3",
      )}
    >
      <span
        aria-hidden
        className="shrink-0 -rotate-8 drop-shadow-[0_2px_3px_rgba(0,0,0,0.28)] transition-transform duration-250 group-hover:-translate-y-0.5 group-hover:-rotate-2"
      >
        <span
          className={cn(
            "flex flex-col bg-white [clip-path:polygon(0_0,100%_0,100%_92%,87.5%_100%,75%_92%,62.5%_100%,50%_92%,37.5%_100%,25%_92%,12.5%_100%,0_92%)]",
            big ? "h-12 w-9 gap-1 px-1.5 py-[7px]" : "h-10 w-[30px] gap-[3px] px-[5px] py-1.5",
          )}
        >
          <i className="mx-auto mb-0.5 block h-0.5 w-3/5 rounded-[1px] bg-[#37352f]" />
          <i className="block h-0.5 rounded-[1px] bg-[#cfcec9]" />
          <i className="block h-0.5 rounded-[1px] bg-[#cfcec9]" />
          <i className="block h-0.5 rounded-[1px] bg-[#cfcec9]" />
          <i className="ml-auto block h-0.5 w-[70%] rounded-[1px] bg-[#37352f]" />
        </span>
      </span>
      <span className="min-w-0">
        <b className={cn("block font-extrabold", big ? "text-[17px]" : "text-[15.5px]")}>{t.receipt.share}</b>
        <small className={cn("block font-semibold opacity-85", big ? "text-[13px]" : "text-[12px]")}>
          {t.page.shareDesc}
        </small>
      </span>
      <span aria-hidden className="ml-auto text-[18px] font-bold">
        ›
      </span>
    </button>
  );
}
