"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { summarize, type BillDoc, type Payment } from "@/lib/bill";
import { useHydrated, useOwnerToken } from "@/lib/store";
import { useBillLive } from "@/hooks/use-bill-live";
import { ReceiptView } from "./receipt-view";
import { Settled } from "./settled";
import { Tracking } from "./tracking";

export type SharedBillData = {
  id: string;
  doc: BillDoc;
  payments: Payment[];
  createdAt: string;
  expiresAt: string;
};

/**
 * Owner (the browser that shared it): tracking page, or the settled page once everyone has paid.
 * Everyone else: just the receipt, which already shows who pays who, where, and what is paid.
 */
export function SharedBill({ bill }: { bill: SharedBillData }) {
  useBillLive(bill.id);
  const hydrated = useHydrated();
  const ownerToken = useOwnerToken(bill.id);
  const [view, setView] = useState<"main" | "receipt" | "payments">("main");
  const { t } = useI18n();

  if (!hydrated) return <div className="min-h-dvh bg-paper-bg" />;

  const summary = summarize(bill.doc, bill.payments);
  const sharerName = bill.doc.people[0]?.name ?? "";

  if (!ownerToken) return <ReceiptView bill={bill} sharedBy={sharerName} />;
  if (view === "receipt")
    return (
      <ReceiptView bill={bill} sharedBy={sharerName} back={{ label: t.receipt.back, onClick: () => setView("main") }} />
    );
  if (view === "main" && summary.remaining.length === 0 && summary.done.length > 0)
    return <Settled bill={bill} summary={summary} onReview={() => setView("payments")} />;
  return <Tracking bill={bill} summary={summary} ownerToken={ownerToken} onViewReceipt={() => setView("receipt")} />;
}
