"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setBillLock } from "@/app/actions";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { useI18n } from "@/i18n/client";
import { latestFriendChange } from "@/lib/bill";
import { getDraft, saveDraft, useDraft } from "@/lib/store";
import type { SharedBillData } from "./shared-bill";

const action = "h-9 text-[13.5px] font-bold text-green-ink disabled:opacity-60";

export function OwnerActions({ bill, ownerToken }: { bill: SharedBillData; ownerToken: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const draft = useDraft();
  const [pending, start] = useTransition();
  const [linkOpen, setLinkOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const locked = Boolean(bill.doc.locked);
  const link = typeof window !== "undefined" ? `${window.location.origin}/bill/${bill.id}#owner=${ownerToken}` : "";

  const editHere = () => {
    saveDraft({ doc: bill.doc, billId: bill.id, seenAt: latestFriendChange(bill.doc) });
    router.push("/");
  };
  const edit = () => {
    const current = getDraft();
    if (current && !current.billId && current.doc.people.length > 0) setReplaceOpen(true);
    else editHere();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ message: t.common.copied });
    } catch {
      toast({ message: t.common.generic });
    }
  };

  const toggleLock = () =>
    start(async () => {
      const result = await setBillLock(bill.id, ownerToken, !locked);
      toast({ message: result.ok ? (locked ? t.track.unlockedNote : t.track.lockedNote) : t.common.generic });
    });

  return (
    <div className="flex flex-wrap items-center gap-x-4">
      {draft?.billId === bill.id ? (
        <Link href="/" className="inline-flex h-9 items-center text-[13.5px] font-bold text-green-ink no-underline">
          {t.track.editBills}
        </Link>
      ) : (
        <button type="button" onClick={edit} className={action}>
          {t.track.editBills}
        </button>
      )}
      <button type="button" onClick={() => setLinkOpen(true)} className={action}>
        {t.track.ownerLink}
      </button>
      <button type="button" disabled={pending} onClick={toggleLock} className={action}>
        {locked ? t.track.unlock : t.track.lock}
      </button>

      <Sheet open={linkOpen} onOpenChange={setLinkOpen} title={t.track.ownerLinkTitle}>
        <p className="m-0 text-[14px] leading-[1.5] text-muted">{t.track.ownerLinkDesc}</p>
        <button type="button" onClick={copy} className="h-14 rounded-2xl bg-green text-[16px] font-bold text-white">
          {t.share.copyLink}
        </button>
      </Sheet>

      <Sheet open={replaceOpen} onOpenChange={setReplaceOpen} title={t.track.replaceTitle}>
        <p className="m-0 text-[14px] leading-[1.5] text-muted">{t.track.replaceDesc}</p>
        <div className="flex flex-col gap-1.5 pt-1">
          <button
            type="button"
            onClick={editHere}
            className="h-14 rounded-2xl bg-green text-[16px] font-bold text-white"
          >
            {t.track.replace}
          </button>
          <button type="button" onClick={() => setReplaceOpen(false)} className="h-11 text-[15px] font-bold text-muted">
            {t.friend.cancel}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
