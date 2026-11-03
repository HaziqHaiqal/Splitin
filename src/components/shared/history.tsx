"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { Sheet } from "@/components/sheet";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { ownerOf, type BillDoc } from "@/lib/bill";
import type { BillEvent, ItemChanges } from "@/lib/history";
import { getSeen, setSeen } from "@/lib/store";
import { avatarColor, cn, initial } from "@/lib/utils";

type Entry = {
  text: string;
  notes?: string[];
  amount?: number;
  tone?: "paid" | "faded";
};

export function HistoryRun({
  who,
  color,
  className,
  children,
}: {
  who: string;
  color?: number;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const shade = color === undefined ? undefined : avatarColor(color);
  return (
    <div className={cn("flex gap-2", className)}>
      {color === undefined ? (
        <span
          aria-hidden
          className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-chip text-[12px] font-extrabold text-muted"
        >
          {who === t.history.someone ? "?" : initial(who)}
        </span>
      ) : (
        <Avatar name={who} color={color} size={30} />
      )}
      <div className="min-w-0 flex-1">
        <div
          aria-hidden
          style={shade && ({ "--name": shade.fg, "--name-dark": shade.dark } as CSSProperties)}
          className={cn(
            "mb-0.5 truncate text-[12px] font-extrabold",
            shade ? "[color:var(--name)] dark:[color:var(--name-dark)]" : "text-muted",
          )}
        >
          {who}
        </div>
        <ul className="m-0 flex list-none flex-col items-start gap-[3px] p-0">{children}</ul>
      </div>
    </div>
  );
}

export function HistoryBubble({ who, text, notes = [], amount, tone, at }: Entry & { who: string; at?: string }) {
  const { money, time } = useI18n();
  return (
    <li
      className={cn(
        "max-w-[290px] rounded-[14px] px-[11px] pt-[7px] pb-1.5 text-[14px] leading-[1.35] font-medium [overflow-wrap:anywhere] first:rounded-tl-[4px]",
        tone === "paid" ? "bg-green-soft text-green-soft-ink" : "bg-chip text-ink",
      )}
    >
      <p className="m-0">
        <span className="sr-only">{who} </span>
        {text.replace("{who} ", "")}
        {amount === undefined ? null : (
          <>
            {" "}
            <span
              className={cn(
                "whitespace-nowrap tabular-nums",
                tone === "faded" ? "font-bold text-muted line-through" : "font-extrabold",
              )}
            >
              {money(amount)}
            </span>
          </>
        )}
      </p>
      {notes.map((note) => (
        <p key={note} className="m-0 mt-0.5 text-[12.5px] leading-[1.4] text-muted">
          {note}
        </p>
      ))}
      {at ? (
        <time
          dateTime={at}
          className={cn("mt-px block text-right text-[11px]", tone === "paid" ? "opacity-75" : "text-muted")}
        >
          {time(at)}
        </time>
      ) : null}
    </li>
  );
}

const pill =
  "mx-auto my-0 w-fit rounded-[12px] bg-chip px-2.5 py-[3px] text-center text-[11.5px] font-semibold text-muted";

const NOTICES: BillEvent["kind"][] = [
  "created",
  "title_changed",
  "person_added",
  "person_removed",
  "person_renamed",
  "person_joined",
  "locked",
  "unlocked",
];

const dayOf = (at: string | Date) => new Date(at).toDateString();

function HistoryList({ doc, events }: { doc: BillDoc; events: BillEvent[] }) {
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
    return parts;
  };

  const whoDid = (e: BillEvent) => {
    if (e.kind === "person_joined") return e.name;
    return e.byName ?? (e.byRole === "owner" ? owner : h.someone);
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

  const colorOf = (e: BillEvent, who: string) => doc.people.find((p) => p.id === e.byPersonId || p.name === who)?.color;

  const runsOf = (day: BillEvent[]) => {
    const runs: BillEvent[][] = [];
    for (const e of day) {
      const last = runs[runs.length - 1];
      const joins = last && !NOTICES.includes(e.kind) && !NOTICES.includes(last[0].kind);
      if (joins && whoDid(last[0]) === whoDid(e)) last.push(e);
      else runs.push([e]);
    }
    return runs;
  };

  return (
    <div className="flex flex-col gap-5">
      {days.map((day) => (
        <section key={day[0].id} className="flex flex-col gap-3">
          <h3 className={pill}>{dayLabel(day[0].createdAt)}</h3>
          {runsOf(day).map((run) => {
            const who = whoDid(run[0]);
            if (NOTICES.includes(run[0].kind))
              return (
                <p key={run[0].id} className={cn(pill, "max-w-[90%] [overflow-wrap:anywhere]")}>
                  {entry(run[0], who).text.replace("{who}", who)} ·{" "}
                  <time dateTime={run[0].createdAt}>{time(run[0].createdAt)}</time>
                </p>
              );
            return (
              <HistoryRun key={run[0].id} who={who} color={colorOf(run[0], who)}>
                {run.map((e) => (
                  <HistoryBubble key={e.id} who={who} at={e.createdAt} {...entry(e, who)} />
                ))}
              </HistoryRun>
            );
          })}
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
      <HistorySheet doc={doc} events={events} open={open} onOpenChange={onOpenChange} />
    </>
  );
}

export function HistorySheet({
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
    <Sheet open={open} onOpenChange={onOpenChange} title={h.title}>
      {events.length === 0 ? (
        <p className="m-0 text-[14px] text-muted">{h.empty}</p>
      ) : (
        <HistoryList doc={doc} events={events} />
      )}
    </Sheet>
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
