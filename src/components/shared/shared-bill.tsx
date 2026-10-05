"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { summarize, type BillDoc, type Payment } from "@/lib/bill";
import { useHydrated, useMe, useOwnerToken } from "@/lib/store";
import { useBillLive } from "@/lib/use-bill-live";
import { FriendDone, FriendView } from "./friend-view";
import { FriendPick } from "./friend-pick";
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

export function SharedBill({ bill }: { bill: SharedBillData }) {
  useBillLive(bill.id);
  const hydrated = useHydrated();
  const ownerToken = useOwnerToken(bill.id);
  const me = useMe(bill.id);
  const [view, setView] = useState<"main" | "receipt">("main");
  const { t } = useI18n();

  if (!hydrated) return <div className="min-h-dvh bg-paper-bg" />;

  const summary = summarize(bill.doc, bill.payments);
  const owner = Boolean(ownerToken);
  const meValid = me && bill.doc.people.some((p) => p.id === me) ? me : null;
  const sharerName = bill.doc.people[0]?.name ?? "";

  if (view === "receipt") return <ReceiptView bill={bill} sharedBy={sharerName} onBack={() => setView("main")} backLabel={t.receipt.back} />;

  if (owner) {
    if (summary.remaining.length === 0 && summary.done.length > 0) return <Settled bill={bill} summary={summary} />;
    return <Tracking bill={bill} summary={summary} ownerToken={ownerToken!} onViewReceipt={() => setView("receipt")} />;
  }

  if (!meValid) return <FriendPick bill={bill} summary={summary} sharedBy={sharerName} onJustLooking={() => setView("receipt")} />;

  const myRemaining = summary.remaining.filter((l) => l.from === meValid);
  const myDone = summary.done.filter((l) => l.from === meValid);
  const collecting = summary.people.find((p) => p.id === meValid)!.net > 0;
  if (!collecting && myRemaining.length === 0) {
    return <FriendDone bill={bill} meId={meValid} done={myDone} onReceipt={() => setView("receipt")} />;
  }
  return <FriendView bill={bill} meId={meValid} summary={summary} onReceipt={() => setView("receipt")} />;
}
