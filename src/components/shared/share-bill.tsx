"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ShareIcon } from "@/components/icons";
import { Receipt } from "@/components/receipt/receipt";
import { ShareSheet } from "@/components/receipt/share-sheet";
import { useI18n } from "@/i18n/client";
import { ownerOf } from "@/lib/bill";
import { cn } from "@/lib/utils";
import type { SharedBillData } from "./shared-bill";

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
  const router = useRouter();
  const paper = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const show = () => {
    router.refresh();
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        aria-label={t.receipt.share}
        title={t.receipt.share}
        onClick={show}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl bg-green font-bold whitespace-nowrap text-white",
          className,
        )}
      >
        <ShareIcon size={18} />
        {label ? t.receipt.share : null}
      </button>
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
}
