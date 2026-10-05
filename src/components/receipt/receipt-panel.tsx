"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { publishBill } from "@/app/actions";
import { ShareIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { useI18n } from "@/i18n/client";
import { saveDraft, setOwnerToken, type Draft } from "@/lib/store";
import { Receipt } from "./receipt";
import { ShareSheet } from "./share-sheet";

/** Step 3 on the home page: its heading with the Share button beside it, then the receipt itself. */
export function ReceiptPanel({ draft, heading }: { draft: Draft; heading: ReactNode }) {
  const { t } = useI18n();
  const toast = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [pending, start] = useTransition();

  const share = () => {
    if (draft.billId) {
      setShareOpen(true);
      return;
    }
    start(async () => {
      const result = await publishBill(draft.doc);
      if (!result.ok) {
        toast({ message: result.error === "rate_limited" ? t.share.rateLimited : t.common.generic });
        return;
      }
      setOwnerToken(result.data.id, result.data.ownerToken);
      saveDraft({ ...draft, billId: result.data.id });
      setShareOpen(true);
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {heading}
        <button type="button" onClick={share} disabled={pending} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-green px-4 text-[15px] font-bold text-white disabled:opacity-70">
          <ShareIcon />
          {t.receipt.share}
        </button>
      </div>
      <div className="mx-auto w-full max-w-[420px]">
        <Receipt ref={receiptRef} doc={draft.doc} billId={draft.billId} />
      </div>
      <ShareSheet open={shareOpen} onOpenChange={setShareOpen} billId={draft.billId} title={draft.doc.title} receiptRef={receiptRef} />
    </>
  );
}
