"use client";

import { useRef, useState, useTransition } from "react";
import { publishBill } from "@/app/actions";
import { ShareIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { useI18n } from "@/i18n/client";
import { saveDraft, setOwnerToken, type Draft } from "@/lib/store";
import { Receipt, Zigzag } from "./receipt";
import { ShareSheet } from "./share-sheet";

/** The receipt with its share button. Used as the phone receipt page and as the desktop side column. */
export function ReceiptPanel({ draft }: { draft: Draft }) {
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
      <Receipt ref={receiptRef} doc={draft.doc} billId={draft.billId} />
      <div className="mt-auto flex flex-col gap-2.5">
        <button
          type="button"
          onClick={share}
          disabled={pending}
          className="flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-green text-[17px] font-bold text-white disabled:opacity-70"
        >
          <ShareIcon />
          {t.receipt.share}
        </button>
      </div>
      <ShareSheet open={shareOpen} onOpenChange={setShareOpen} billId={draft.billId} title={draft.doc.title} receiptRef={receiptRef} />
    </>
  );
}

/** Desktop only: shown in the receipt column before any bill exists. */
export function ReceiptPlaceholder({ label }: { label: string }) {
  return (
    <div className="opacity-70" style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.08))" }}>
      <Zigzag edge="top" />
      <div className="flex flex-col gap-2 bg-[#fffdf6] px-[18px] pt-[18px] pb-6 font-mono text-[12.5px] text-[#b5afa4]">
        <div className="text-center text-[19px] font-bold tracking-[0.32em]">SPLITIN</div>
        <div className="my-1.5 border-t-[1.5px] border-dashed border-[#cfc9be]" />
        <div className="h-2.5 w-4/5 bg-[#ece7dc]" />
        <div className="h-2.5 w-3/5 bg-[#ece7dc]" />
        <div className="h-2.5 w-[70%] bg-[#ece7dc]" />
        <div className="my-1.5 border-t-[1.5px] border-dashed border-[#cfc9be]" />
        <div className="h-3 w-full bg-[#e2ddd1]" />
        <div className="mt-3 text-center font-sans text-[13px] font-semibold text-[#8a8478]">{label}</div>
      </div>
      <Zigzag edge="bottom" />
    </div>
  );
}
