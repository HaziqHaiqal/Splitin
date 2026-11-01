"use client";

import { useEffect, useState } from "react";
import { checkOwnerLink } from "@/app/actions";
import { useToast } from "@/components/toast";
import { useI18n } from "@/i18n/client";
import { ownerOf, summarize, type BillDoc, type Mine, type Payment } from "@/lib/bill";
import type { BillEvent } from "@/lib/history";
import { setOwnerToken, useHydrated, useOwnerToken } from "@/lib/store";
import { useBillLive } from "@/hooks/use-bill-live";
import { ReceiptView } from "./receipt-view";
import { Settled } from "./settled";
import { Tracking } from "./tracking";

export type SharedBillData = {
  id: string;
  doc: BillDoc;
  payments: Payment[];
  events: BillEvent[];
  createdAt: string;
  expiresAt: string;
  mine: Mine;
};

export function SharedBill({ bill }: { bill: SharedBillData }) {
  useBillLive(bill.id);
  const hydrated = useHydrated();
  const ownerToken = useOwnerToken(bill.id) ?? null;
  const [view, setView] = useState<"main" | "receipt" | "payments">("main");
  const [ownerLink] = useState(() => typeof window !== "undefined" && window.location.hash.startsWith("#owner="));
  const { t } = useI18n();
  const toast = useToast();

  useEffect(() => {
    const token = window.location.hash.match(/^#owner=([A-Za-z0-9]+)$/)?.[1];
    if (!token) return;
    window.history.replaceState(null, "", window.location.pathname);
    void checkOwnerLink(bill.id, token).then((result) => {
      if (result.ok) setOwnerToken(bill.id, token);
      toast({ message: result.ok ? t.track.ownerRestored : t.common.generic });
    });
  }, [bill.id, t, toast]);

  if (!hydrated) return <div className="min-h-dvh bg-paper-bg" />;

  const summary = summarize(bill.doc, bill.payments);
  const sharerName = ownerOf(bill.doc)?.name ?? "";

  if (!ownerToken && !bill.mine.owner) return <ReceiptView bill={bill} sharedBy={sharerName} quiet={ownerLink} />;
  if (view === "receipt")
    return (
      <ReceiptView bill={bill} sharedBy={sharerName} back={{ label: t.receipt.back, onClick: () => setView("main") }} />
    );
  if (view === "main" && summary.remaining.length === 0 && summary.done.length > 0)
    return <Settled bill={bill} summary={summary} ownerToken={ownerToken} onReview={() => setView("payments")} />;
  return <Tracking bill={bill} summary={summary} ownerToken={ownerToken} onViewReceipt={() => setView("receipt")} />;
}
