"use client";

import { TopBar } from "@/components/header";
import { Receipt } from "@/components/receipt/receipt";
import { useI18n } from "@/i18n/client";
import type { SharedBillData } from "./shared-bill";

export function ReceiptView({ bill, sharedBy, onBack, backLabel }: { bill: SharedBillData; sharedBy: string; onBack: () => void; backLabel: string }) {
  const { t } = useI18n();
  return (
    <div data-paper className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-[14px] bg-paper-bg px-5 pb-[22px] text-ink">
      <TopBar back={{ label: backLabel, onClick: onBack }} title={t.receipt.title} />
      <Receipt doc={bill.doc} payments={bill.payments} billId={bill.id} expiresAt={bill.expiresAt} sharedBy={sharedBy} />
    </div>
  );
}
