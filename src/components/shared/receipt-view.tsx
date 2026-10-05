"use client";

import { BackIcon } from "@/components/icons";
import { Receipt } from "@/components/receipt/receipt";
import { useI18n } from "@/i18n/client";
import type { SharedBillData } from "./shared-bill";

export function ReceiptView({ bill, sharedBy, onBack, backLabel }: { bill: SharedBillData; sharedBy: string; onBack: () => void; backLabel: string }) {
  const { t } = useI18n();
  return (
    <div data-paper className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-[14px] bg-paper-bg px-5 pt-[14px] pb-[22px] text-ink">
      <div className="flex h-10 items-center justify-between">
        <button type="button" onClick={onBack} className="flex h-10 items-center gap-1 pr-1.5 text-[15px] font-bold text-ink">
          <BackIcon />
          {backLabel}
        </button>
        <span className="text-[16px] font-extrabold">{t.receipt.title}</span>
        <span className="w-[52px]" />
      </div>
      <Receipt doc={bill.doc} payments={bill.payments} billId={bill.id} expiresAt={bill.expiresAt} sharedBy={sharedBy} />
    </div>
  );
}
