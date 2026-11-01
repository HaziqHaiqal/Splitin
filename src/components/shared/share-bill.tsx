"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ShareIcon } from "@/components/icons";
import { Receipt } from "@/components/receipt/receipt";
import { ShareSheet } from "@/components/receipt/share-sheet";
import { useI18n } from "@/i18n/client";
import { ownerOf } from "@/lib/bill";
import type { SharedBillData } from "./shared-bill";

export function ShareBill({ bill, bigStamp }: { bill: SharedBillData; bigStamp?: string }) {
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
        className="inline-flex size-9 items-center justify-center rounded-full text-green-ink transition-colors hover:bg-chip"
      >
        <ShareIcon size={19} />
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
