"use client";

import { useRef, useState, useTransition } from "react";
import { publishBill } from "@/app/actions";
import { useToast } from "@/components/toast";
import { useI18n } from "@/i18n/client";
import { saveDraft, setOwnerToken, type Draft } from "@/lib/store";
import { ShareSheet } from "@/components/receipt/share-sheet";

/**
 * Sharing the receipt on the home page. The first share saves the bill and creates its link; after that it only
 * reopens the share panel. `receiptRef` goes on the printed receipt, which becomes the shared picture.
 */
export function useShareReceipt(draft: Draft | null | undefined) {
  const { t } = useI18n();
  const toast = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const share = () => {
    if (!draft) return;
    if (draft.billId) {
      setOpen(true);
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
      setOpen(true);
    });
  };

  const sheet = draft ? (
    <ShareSheet
      open={open}
      onOpenChange={setOpen}
      billId={draft.billId}
      title={draft.doc.title}
      createdAt={draft.doc.createdAt}
      receiptRef={receiptRef}
    />
  ) : null;

  return { share, pending, receiptRef, sheet };
}
