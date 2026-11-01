"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setBillLock } from "@/app/actions";
import { Sheet, SheetOption } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { useI18n } from "@/i18n/client";
import { latestMemberChange } from "@/lib/bill";
import { getDraft, saveDraft, useDraft } from "@/lib/store";
import type { SharedBillData } from "./shared-bill";

const action = "h-9 text-[13.5px] font-bold text-green-ink";

export function OwnerActions({
  bill,
  ownerToken,
  onRecord,
}: {
  bill: SharedBillData;
  ownerToken: string | null;
  onRecord?: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const draft = useDraft();
  const [pending, start] = useTransition();
  const [moreOpen, setMoreOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const locked = Boolean(bill.doc.locked);

  const editHere = () => {
    saveDraft({ doc: bill.doc, billId: bill.id, seenAt: latestMemberChange(bill.doc) });
    router.push("/");
  };
  const edit = () => {
    const current = getDraft();
    if (current && !current.billId && current.doc.people.length > 0) setReplaceOpen(true);
    else editHere();
  };

  const record = () => {
    setMoreOpen(false);
    if (onRecord) requestAnimationFrame(onRecord);
  };

  const copyLink = async () => {
    setMoreOpen(false);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/bill/${bill.id}#owner=${ownerToken}`);
      toast({ message: t.common.copied });
    } catch {
      toast({ message: t.common.generic });
    }
  };

  const toggleLock = () =>
    start(async () => {
      const result = await setBillLock(bill.id, ownerToken, !locked);
      setMoreOpen(false);
      toast({ message: result.ok ? (locked ? t.track.unlockedNote : t.track.lockedNote) : t.common.generic });
    });

  return (
    <>
      {draft?.billId === bill.id ? (
        <Link href="/" className={`${action} inline-flex items-center no-underline`}>
          {t.track.editBills}
        </Link>
      ) : (
        <button type="button" onClick={edit} className={action}>
          {t.track.editBills}
        </button>
      )}
      <button type="button" onClick={() => setMoreOpen(true)} className={action}>
        {t.track.more}
      </button>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title={t.track.more}>
        <div className="flex flex-col gap-2">
          {onRecord ? <SheetOption title={t.pay.ownerLink} desc={t.pay.desc} onClick={record} /> : null}
          {ownerToken ? (
            <SheetOption title={t.track.ownerLink} desc={t.track.ownerLinkDesc} onClick={copyLink} />
          ) : null}
          <SheetOption
            title={locked ? t.track.unlock : t.track.lock}
            desc={locked ? t.track.unlockDesc : t.track.lockDesc}
            disabled={pending}
            onClick={toggleLock}
          />
        </div>
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
            {t.member.cancel}
          </button>
        </div>
      </Sheet>
    </>
  );
}
