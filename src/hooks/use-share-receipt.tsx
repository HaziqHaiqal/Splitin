"use client";

import { useRef, useState, useTransition } from "react";
import { publishBill } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { useI18n } from "@/i18n/client";
import { saveDraft, setOwnerToken, type Draft } from "@/lib/store";
import { ShareSheet } from "@/components/receipt/share-sheet";

export function useShareReceipt(draft: Draft | null | undefined) {
  const { t } = useI18n();
  const toast = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();

  const publish = (current: Draft) => {
    if (current.billId) {
      setOpen(true);
      return;
    }
    start(async () => {
      const result = await publishBill(current.doc);
      if (!result.ok) {
        toast({ message: result.error === "rate_limited" ? t.share.rateLimited : t.common.generic });
        return;
      }
      setOwnerToken(result.data.id, result.data.ownerToken);
      saveDraft({ ...current, billId: result.data.id });
      setOpen(true);
    });
  };

  const share = () => {
    if (!draft) return;
    if (!draft.billId && draft.doc.ownerId === undefined) setAsking(true);
    else publish(draft);
  };

  const pickOwner = (ownerId: string | null) => {
    if (!draft) return;
    const next = { ...draft, doc: { ...draft.doc, ownerId } };
    saveDraft(next);
    setAsking(false);
    publish(next);
  };

  const sheet = draft ? (
    <>
      <ShareSheet
        open={open}
        onOpenChange={setOpen}
        billId={draft.billId}
        title={draft.doc.title}
        createdAt={draft.doc.createdAt}
        receiptRef={receiptRef}
      />
      <Sheet open={asking} onOpenChange={setAsking} title={t.share.whichTitle}>
        <p className="m-0 text-[14px] text-muted">{t.share.whichDesc}</p>
        <div className="flex flex-col gap-2">
          {draft.doc.people.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pickOwner(p.id)}
              className="flex h-12 shrink-0 items-center gap-2.5 rounded-xl bg-chip px-2.5 text-left text-[15px] font-bold text-ink"
            >
              <Avatar name={p.name} color={p.color} size={30} />
              <span className="min-w-0 truncate">{p.name}</span>
            </button>
          ))}
          <button type="button" onClick={() => pickOwner(null)} className="h-11 text-[15px] font-bold text-muted">
            {t.friend.notListed}
          </button>
        </div>
      </Sheet>
    </>
  ) : null;

  return { share, pending, receiptRef, sheet };
}
