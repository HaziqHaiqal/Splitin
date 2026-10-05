"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useDraftSync } from "@/components/draft-sync";
import { BackIcon } from "@/components/icons";
import { useIsDesktop } from "@/components/sheet";
import { useI18n } from "@/i18n/client";
import { useDraft } from "@/lib/store";
import { ReceiptPanel } from "./receipt-panel";

export function ReceiptScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const draft = useDraft();
  useDraftSync(draft);

  const desktop = useIsDesktop();
  const empty = draft !== undefined && (!draft || draft.doc.items.length === 0);
  useEffect(() => {
    if (empty || desktop) router.replace("/");
  }, [empty, desktop, router]);

  if (!draft || draft.doc.items.length === 0) return <div data-paper className="min-h-dvh bg-paper-bg" />;

  return (
    <div data-paper className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-[14px] bg-paper-bg px-5 pt-[14px] pb-[22px] text-ink">
      <div className="flex h-10 items-center justify-between">
        <Link href="/" className="flex h-10 items-center gap-1 pr-1.5 text-[15px] font-bold text-ink no-underline">
          <BackIcon />
          {t.receipt.back}
        </Link>
        <span className="text-[16px] font-extrabold">{t.receipt.title}</span>
        <span className="w-[52px]" />
      </div>
      <ReceiptPanel draft={draft} />
    </div>
  );
}
