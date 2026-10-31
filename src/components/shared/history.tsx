"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/sheet";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { ownerOf, type BillDoc } from "@/lib/bill";
import type { BillEvent, ItemChanges } from "@/lib/history";
import { getSeen, setSeen } from "@/lib/store";

export function HistoryButton({
  doc,
  events,
  open,
  onOpenChange,
}: {
  doc: BillDoc;
  events: BillEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, money, date, time } = useI18n();
  const h = t.history;
  const owner = ownerOf(doc)?.name ?? h.owner;

  const changeList = (changes: ItemChanges) => {
    const parts: string[] = [];
    if (changes.name) parts.push(fmt(h.changeName, { from: changes.name[0], to: changes.name[1] }));
    if (changes.amount)
      parts.push(fmt(h.changeAmount, { from: money(changes.amount[0]), to: money(changes.amount[1]) }));
    if (changes.payer) parts.push(fmt(h.changePayer, { from: changes.payer[0], to: changes.payer[1] }));
    if (changes.split) parts.push(h.changeSplit);
    return parts.join(", ");
  };

  const line = (e: BillEvent) => {
    const who = e.actor === "owner" ? owner : (e.by ?? h.friend);
    switch (e.kind) {
      case "created":
        return fmt(h.created, { who });
      case "item_added":
        return fmt(h.itemAdded, { who, name: e.name, amount: money(e.amountMinor), payer: e.payer });
      case "item_deleted":
        return fmt(h.itemDeleted, { who, name: e.name, amount: money(e.amountMinor) });
      case "item_edited":
        return `${fmt(h.itemEdited, { who, name: e.name })}: ${changeList(e.changes)}`;
      case "title_changed":
        return fmt(h.titleChanged, { who, to: e.to });
      case "person_added":
        return fmt(h.personAdded, { who, name: e.name });
      case "person_removed":
        return fmt(h.personRemoved, { who, name: e.name });
      case "person_renamed":
        return fmt(h.personRenamed, { who, from: e.from, to: e.to });
      case "person_details":
        return fmt(h.personDetails, { who, name: e.name });
      case "person_joined":
        return fmt(h.personJoined, { name: e.name });
      case "bill_joined":
        return fmt(h.billJoined, { who, name: e.name, amount: money(e.amountMinor) });
      case "bill_left":
        return fmt(h.billLeft, { who, name: e.name });
      case "share_changed":
        return fmt(h.shareChanged, { who, name: e.name, from: money(e.from), to: money(e.to) });
      case "locked":
        return fmt(h.locked, { who });
      case "unlocked":
        return fmt(h.unlocked, { who });
      case "paid":
        return fmt(h.paid, { who, from: e.from, to: e.to, amount: money(e.amountMinor) });
      case "unpaid":
        return fmt(h.unpaid, { who, from: e.from, to: e.to, amount: money(e.amountMinor) });
    }
  };

  return (
    <>
      <button type="button" onClick={() => onOpenChange(true)} className="h-9 text-[13.5px] font-bold text-green-ink">
        {h.title}
        {events.length > 0 ? ` · ${events.length}` : ""}
      </button>
      <Sheet open={open} onOpenChange={onOpenChange} title={h.title}>
        {events.length === 0 ? (
          <p className="m-0 text-[14px] text-muted">{h.empty}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {events.map((e, i) => (
              <li key={e.id} className={`py-2.5 ${i > 0 ? "border-t border-line" : ""}`}>
                <span className="block text-[14px] leading-[1.45]">{line(e)}</span>
                <span className="mt-0.5 block text-[12px] text-muted">
                  {date(e.createdAt, { day: "numeric", month: "short" })} · {time(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}

export function useChangesSinceVisit(
  billId: string,
  createdAt: string,
  events: BillEvent[],
  mine: (e: BillEvent) => boolean,
) {
  const [since, setSince] = useState(() => getSeen(billId));
  const latest = events[0]?.createdAt ?? createdAt;

  useEffect(() => {
    setSeen(billId, latest);
  }, [billId, latest]);

  return {
    count: since ? events.filter((e) => e.createdAt > since && !mine(e)).length : 0,
    clear: () => setSince(latest),
  };
}

export function ChangesBanner({ count, onShow }: { count: number; onShow: () => void }) {
  const { t } = useI18n();
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onShow}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-green-soft px-3.5 py-2 text-left text-[13.5px] font-bold text-green-soft-ink"
    >
      <span>{fmt(count === 1 ? t.history.oneChange : t.history.changes, { count })}</span>
      <span className="shrink-0 underline underline-offset-2">{t.history.see}</span>
    </button>
  );
}
