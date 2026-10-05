"use client";

import { Header } from "@/components/header";
import { Receipt } from "@/components/receipt/receipt";
import { useIsDesktop } from "@/components/sheet";
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
      <button type="button" onClick={onJustLooking} className="h-10 text-[14px] font-bold text-green-ink md:hidden">
        {t.friend.justLooking}
      </button>
    </>
  );
}

export function FriendPick({ bill, summary, sharedBy, onJustLooking }: Props) {
  const { t } = useI18n();
  const desktop = useIsDesktop();
  return (
    <div data-paper className="relative mx-auto min-h-dvh w-full max-w-[430px] bg-paper-bg text-ink md:max-w-[920px]">
      <div className="px-5 pt-[14px] pb-[380px] md:px-6 xl:px-8 md:pt-6 md:pb-10">
        <Header theme={false} />
        <div className="mt-3 md:mt-8 md:grid md:grid-cols-[350px_minmax(0,1fr)] xl:grid-cols-[390px_minmax(0,1fr)] md:items-start md:gap-6 xl:gap-10">
          <Receipt doc={bill.doc} payments={bill.payments} billId={bill.id} expiresAt={bill.expiresAt} sharedBy={sharedBy} />
          {desktop ? (
            <div className="sticky top-6 flex flex-col gap-[14px] rounded-[24px] bg-sheet p-6 shadow-[0_1px_2px_rgba(28,31,29,0.06)]">
              <Picker bill={bill} summary={summary} onJustLooking={onJustLooking} />
            </div>
          ) : null}
        </div>
      </div>
      {desktop ? null : (
        <>
          <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(28,31,29,0)_30%,rgba(28,31,29,0.35)_55%)]" />
          <div
            role="dialog"
            aria-label={t.friend.pickTitle}
            className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-[430px] flex-col gap-[14px] rounded-t-[24px] bg-sheet px-5 pt-5 pb-[max(24px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
          >
            <Picker bill={bill} summary={summary} onJustLooking={onJustLooking} />
          </div>
        </>
      )}
    </div>
  );
}
