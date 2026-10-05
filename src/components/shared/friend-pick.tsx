"use client";

import { Header } from "@/components/header";
import { Receipt } from "@/components/receipt/receipt";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { BillSummary } from "@/lib/bill";
import { setMe } from "@/lib/store";
import type { SharedBillData } from "./shared-bill";

type Props = {
  bill: SharedBillData;
  summary: BillSummary;
  sharedBy: string;
  onJustLooking: () => void;
};

function Picker({ bill, summary, onJustLooking }: Omit<Props, "sharedBy">) {
  const { t, money } = useI18n();
  return (
    <>
      <div>
        <div className="text-[22px] font-extrabold tracking-[-0.02em]">{t.friend.pickTitle}</div>
        <div className="mt-1 text-[14px] text-muted">{t.friend.pickDesc}</div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {bill.doc.people.map((p) => {
          const bal = summary.balances[p.id] ?? 0;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setMe(bill.id, p.id)}
              className="h-[74px] rounded-2xl border-[1.5px] border-border bg-field px-[14px] text-left text-ink hover:border-green"
            >
              <span className="block truncate text-[16px] font-extrabold">{p.name}</span>
              <span className={`mt-0.5 block text-[13px] font-semibold ${bal < 0 ? "text-owe" : bal > 0 ? "text-green-ink" : "text-muted"}`}>
                {bal < 0 ? fmt(t.friend.owes, { amount: money(-bal) }) : bal > 0 ? fmt(t.friend.collects, { amount: money(bal) }) : t.friend.settledUp}
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" onClick={onJustLooking} className="h-10 text-[14px] font-bold text-green-ink">
        {t.friend.justLooking}
      </button>
    </>
  );
}

/** The same on every screen size: the receipt in one column, the name picker as a panel along the bottom. */
export function FriendPick({ bill, summary, sharedBy, onJustLooking }: Props) {
  const { t } = useI18n();
  return (
    <div data-paper className="relative mx-auto min-h-dvh w-full max-w-[460px] bg-paper-bg text-ink">
      {/* bottom padding lets the end of the receipt scroll up clear of the panel */}
      <div className="max-w-[inherit] bg-inherit px-5 pb-[380px]">
        <Header theme={false} />
        <Receipt doc={bill.doc} payments={bill.payments} billId={bill.id} expiresAt={bill.expiresAt} sharedBy={sharedBy} />
      </div>
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(28,31,29,0)_30%,rgba(28,31,29,0.35)_55%)]" />
      <div
        role="dialog"
        aria-label={t.friend.pickTitle}
        className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-[460px] flex-col gap-[14px] rounded-t-[24px] bg-sheet px-5 pt-5 pb-[max(24px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
      >
        <Picker bill={bill} summary={summary} onJustLooking={onJustLooking} />
      </div>
    </div>
  );
}
