"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Sheet } from "@/components/sheet";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { ownerOf, type BillDoc } from "@/lib/bill";
import type { BillEvent, ItemChanges } from "@/lib/history";
import { getSeen, setSeen } from "@/lib/store";
import { cn, initial } from "@/lib/utils";

type Entry = {
  text: string;
  notes?: string[];
  amount?: number;
  tone?: "paid" | "faded";
};

export function HistoryRow({
  who,
  color,
  text,
  notes = [],
  amount,
  tone,
  at,
  className,
}: Entry & { who: string; color?: number; at?: string; className?: string }) {
  const { t, money, time } = useI18n();
  const [before, ...after] = text.split("{who}");
  return (
    <li className={cn("flex items-start gap-3", className)}>
      {color === undefined ? (
        <span
          aria-hidden
          className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-chip text-[12px] font-extrabold text-muted"
        >
          {who === t.history.friend ? "?" : initial(who)}
        </span>
      ) : (
        <Avatar name={who} color={color} size={30} />
      )}
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <p className="m-0 text-[14px] leading-[1.4] font-medium text-ink">
          {before}
          <b className="font-extrabold">{who}</b>
          {after.join("{who}")}
        </p>
        {notes.map((note) => (
          <p key={note} className="m-0 mt-0.5 text-[12.5px] leading-[1.4] text-muted">
            {note}
          </p>
        ))}
        {at ? (
          <time dateTime={at} className="mt-0.5 block text-[12px] text-muted">
            {time(at)}
          </time>
        ) : null}
      </div>
      {amount === undefined ? null : (
        <span
          className={cn(
            "shrink-0 text-[14px] leading-[1.4] font-bold whitespace-nowrap tabular-nums",
            tone === "paid" ? "text-green-ink" : tone === "faded" ? "text-muted" : "text-ink",
          )}
        >
          {money(amount)}
        </span>
      )}
    </li>
  );
}

const dayOf = (at: string | Date) => new Date(at).toDateString();

function HistoryList({ doc, events }: { doc: BillDoc; events: BillEvent[] }) {
  const { t, money, date } = useI18n();
  const h = t.history;
  const owner = ownerOf(doc)?.name ?? h.owner;

  const changeList = (changes: ItemChanges) => {
    const parts: string[] = [];
    if (changes.name) parts.push(fmt(h.changeName, { from: changes.name[0], to: changes.name[1] }));
    if (changes.amount)
      parts.push(fmt(h.changeAmount, { from: money(changes.amount[0]), to: money(changes.amount[1]) }));
    if (changes.payer) parts.push(fmt(h.changePayer, { from: changes.payer[0], to: changes.payer[1] }));
    if (changes.split) parts.push(h.changeSplit);
    return parts;
  };

  const whoDid = (e: BillEvent) => {
    if (e.kind === "person_joined") return e.name;
    return e.actor === "owner" ? owner : (e.by ?? h.friend);
  };

  const entry = (e: BillEvent, who: string): Entry => {
    switch (e.kind) {
      case "created":
        return { text: h.created };
      case "item_added":
        return {
          text: fmt(h.itemAdded, { name: e.name }),
          notes: [fmt(h.paidBy, { payer: e.payer })],
          amount: e.amountMinor,
        };
      case "item_deleted":
        return { text: fmt(h.itemDeleted, { name: e.name }), amount: e.amountMinor, tone: "faded" };
      case "item_edited":
        return { text: fmt(h.itemEdited, { name: e.name }), notes: changeList(e.changes) };
      case "title_changed":
        return { text: fmt(h.titleChanged, { to: e.to }) };
      case "person_added":
        return { text: fmt(h.personAdded, { name: e.name }) };
      case "person_removed":
        return { text: fmt(h.personRemoved, { name: e.name }) };
      case "person_renamed":
        return { text: fmt(h.personRenamed, { from: e.from, to: e.to }) };
      case "person_details":
        return { text: who === e.name ? h.ownDetails : fmt(h.personDetails, { name: e.name }) };
      case "person_joined":
        return { text: h.personJoined };
      case "bill_joined":
        return { text: fmt(h.billJoined, { name: e.name }), amount: e.amountMinor };
      case "bill_left":
        return { text: fmt(h.billLeft, { name: e.name }) };
      case "share_changed":
        return { text: fmt(h.shareChanged, { name: e.name }), notes: [`${money(e.from)} → ${money(e.to)}`] };
      case "locked":
        return { text: h.locked };
      case "unlocked":
        return { text: h.unlocked };
      case "paid":
        return {
          text: fmt(who === e.from ? h.paid : h.paidFor, { from: e.from, to: e.to }),
          amount: e.amountMinor,
          tone: "paid",
        };
      case "unpaid":
        return {
          text: fmt(who === e.from ? h.unpaid : h.unpaidFor, { from: e.from, to: e.to }),
          amount: e.amountMinor,
          tone: "faded",
        };
    }
  };

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dayLabel = (at: string) => {
    if (dayOf(at) === dayOf(today)) return h.today;
    if (dayOf(at) === dayOf(yesterday)) return h.yesterday;
    return date(at, { day: "numeric", month: "short" });
  };

  const days: BillEvent[][] = [];
  for (const e of events) {
    const last = days[days.length - 1];
    if (last && dayOf(last[0].createdAt) === dayOf(e.createdAt)) last.push(e);
    else days.push([e]);
  }

  return (
    <div className="flex flex-col gap-5">
      {days.map((day) => (
        <section key={day[0].id}>
          <h3 className="m-0 pt-1 pb-2.5 text-[11px] font-bold tracking-[0.06em] text-muted uppercase">
            {dayLabel(day[0].createdAt)}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {day.map((e) => {
              const who = whoDid(e);
              return (
                <HistoryRow
                  key={e.id}
                  who={who}
                  color={doc.people.find((p) => p.name === who)?.color}
                  at={e.createdAt}
                  {...entry(e, who)}
                />
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

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
  const { t } = useI18n();
  const h = t.history;

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
          <HistoryList doc={doc} events={events} />
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
