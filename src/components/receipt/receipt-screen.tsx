"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { publishBill } from "@/app/actions";
import { useDraftSync } from "@/components/draft-sync";
import { TopBar } from "@/components/header";
import { ShareIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { useI18n } from "@/i18n/client";
import { saveDraft, setOwnerToken, useDraft } from "@/lib/store";
import { Receipt } from "./receipt";
import { ShareSheet } from "./share-sheet";

/** The receipt on its own page, the same on phone and desktop. Share is the icon in the top bar. */
export function ReceiptScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const draft = useDraft();
  useDraftSync(draft);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [pending, start] = useTransition();

  const empty = draft !== undefined && (!draft || draft.doc.items.length === 0);
  useEffect(() => {
    if (empty) router.replace("/");
  }, [empty, router]);

  if (!draft || draft.doc.items.length === 0) return <div data-paper className="min-h-dvh bg-paper-bg" />;

  // The first share saves the bill and creates its link; after that it only reopens the share panel.
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
    <div data-paper className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col bg-paper-bg px-5 pb-8 text-ink">
      <TopBar
        back={{ label: t.receipt.back, href: "/" }}
        title={t.receipt.title}
        action={
          <button
            type="button"
            onClick={share}
            disabled={pending}
            aria-label={t.receipt.share}
            title={t.receipt.share}
            className="-mr-2 inline-flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-chip disabled:opacity-50"
          >
            <ShareIcon size={21} />
          </button>
        }
      />
      <Receipt ref={receiptRef} doc={draft.doc} billId={draft.billId} />
      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        billId={draft.billId}
        title={draft.doc.title}
        createdAt={draft.doc.createdAt}
        receiptRef={receiptRef}
      />
    </div>
  );
}
