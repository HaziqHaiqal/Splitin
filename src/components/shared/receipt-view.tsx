"use client";

import { useState, useTransition } from "react";
import { addFriendItem, addPayment, removeFriendItem, removePayment } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { TopBar } from "@/components/header";
import { BillForm } from "@/components/home/bill-form";
import { PlusIcon } from "@/components/icons";
import { PrinterPage } from "@/components/receipt/printer";
import { Receipt } from "@/components/receipt/receipt";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { summarize, type Item, type PlanLine } from "@/lib/bill";
import { getMe, NOT_LISTED, setMe, setMyItem, useMe, useMyItems } from "@/lib/store";
import { HistoryButton } from "./history";
import type { SharedBillData } from "./shared-bill";

export function ReceiptView({
  bill,
  sharedBy,
  back,
}: {
  bill: SharedBillData;
  sharedBy: string;
  back?: { label: string; onClick: () => void };
}) {
  const { t, money, date } = useI18n();
  const toast = useToast();
  const [line, setLine] = useState<PlanLine | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<Item | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const desktop = useIsDesktop();
  const mine = useMyItems(bill.id);
  const me = useMe(bill.id);
  const [asking, setAsking] = useState<{ then: () => void } | null>(null);
  const nameOf = (id: string) => bill.doc.people.find((p) => p.id === id)?.name ?? "?";
  const myName = bill.doc.people.find((p) => p.id === me)?.name;
  const known = me === NOT_LISTED || Boolean(myName);
  const friend = !back;

  const withMe = (then: () => void) => (known ? then() : setAsking({ then }));
  const pick = (id: string) => {
    setMe(bill.id, id);
    setAsking(null);
    asking?.then();
  };
  const summary = summarize(bill.doc, bill.payments);

  const receivers = [...new Set([...summary.remaining, ...summary.done].map((l) => l.to))]
    .map((id) => bill.doc.people.find((p) => p.id === id))
    .filter((p) => p?.bank && p.accountNo);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text.replace(/\s+/g, ""));
      toast({ message: t.common.copied });
    } catch {
      toast({ message: t.common.generic });
    }
  };

  const confirm = () => {
    if (!line) return;
    const l = line;
    start(async () => {
      const result = await addPayment(
        bill.id,
        { from: l.from, to: l.to, amountMinor: l.amount },
        undefined,
        getMe(bill.id),
      );
      setOpen(false);
      if (!result.ok) return void toast({ message: t.common.generic });
      toast({
        message: fmt(t.friend.marked, { name: nameOf(l.to) }),
        action: {
          label: t.common.undo,
          onClick: () => void removePayment(bill.id, result.data.id, undefined, getMe(bill.id)),
        },
      });
    });
  };

  const addItem = (item: Item) =>
    start(async () => {
      const result = await addFriendItem(bill.id, item, getMe(bill.id));
      if (!result.ok) return void toast({ message: t.common.generic });
      const { id, token } = result.data;
      setMyItem(bill.id, id, token);
      setFreshId(id);
      toast({
        message: fmt(t.friend.added, { name: item.name }),
        action: { label: t.common.undo, onClick: () => deleteItem({ ...item, id }, token) },
      });
    });

  const deleteItem = (item: Item, token: string) =>
    start(async () => {
      const result = await removeFriendItem(bill.id, item.id, token, getMe(bill.id));
      if (!result.ok) return void toast({ message: t.common.generic });
      setMyItem(bill.id, item.id, null);
      toast({
        message: fmt(t.bill.deleted, { name: item.name }),
        action: { label: t.common.undo, onClick: () => addItem(item) },
      });
    });

  const myItems = friend ? bill.doc.items.filter((i) => i.deleteHash && mine[i.id]) : [];
  const myList =
    myItems.length > 0 ? (
      <div className="rounded-2xl border border-border bg-card px-4 pt-3 pb-1">
        <span className="text-[11px] font-bold tracking-[0.06em] text-faint uppercase">{t.friend.yours}</span>
        {myItems.map((item, i) => (
          <div
            key={item.id}
            className={`flex items-center justify-between gap-3 py-2.5 ${i > 0 ? "border-t border-line" : ""}`}
          >
            <span className="min-w-0 truncate">
              <b className="text-[14.5px]">{item.name}</b>
              <span className="text-[13px] text-muted"> · {money(item.amountMinor)}</span>
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => withMe(() => deleteItem(item, mine[item.id]))}
              className="h-[34px] shrink-0 rounded-lg border border-border bg-card px-3 text-[13px] font-bold text-owe disabled:opacity-60"
            >
              {t.friend.deleteMine}
            </button>
          </div>
        ))}
      </div>
    ) : null;

  const history = <HistoryButton doc={bill.doc} events={bill.events} />;

  const changeMe =
    friend && known ? (
      <button
        type="button"
        onClick={() => setAsking({ then: () => undefined })}
        className="h-9 text-[13.5px] font-bold text-muted"
      >
        {myName ? fmt(t.friend.notYou, { name: myName }) : t.friend.whoTitle}
      </button>
    ) : null;

  const billForm = (bare: boolean) => (
    <BillForm
      item={null}
      doc={bill.doc}
      first={false}
      bare={bare}
      autoFocus={desktop}
      title={t.friend.addTitle}
      defaultPaidBy={myName ? (me ?? undefined) : undefined}
      onAdd={addItem}
      onPrinted={() => setAdding(false)}
      onCancel={() => setAdding(false)}
      onPreview={setPreview}
    />
  );

  const addButton = (className: string) => (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        withMe(() =>
          requestAnimationFrame(() => {
            setAdding(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }),
        )
      }
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card font-bold text-ink disabled:opacity-60 ${className}`}
    >
      <PlusIcon size={16} />
      {t.friend.addPaid}
    </button>
  );

  const side = (
    <>
      <span className="text-[11px] font-bold tracking-[0.06em] text-faint uppercase">
        {fmt(t.friend.sharedLine, {
          name: sharedBy,
          date: date(bill.createdAt, { day: "numeric", month: "short" }),
        })}
      </span>
      <h1 className="m-0 text-[30px] font-extrabold tracking-[-0.025em]">{bill.doc.title}</h1>
      {friend && summary.remaining.length > 0 ? (
        <p className="m-0 max-w-[46ch] text-[14.5px] leading-[1.5] text-muted">{t.friend.findYours}</p>
      ) : null}
      {receivers.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card px-4 pt-3 pb-1">
          <span className="text-[11px] font-bold tracking-[0.06em] text-faint uppercase">{t.friend.payTo}</span>
          {receivers.map((p, i) => (
            <div
              key={p!.id}
              className={`flex items-center justify-between gap-3 py-3 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <span className="min-w-0">
                <b className="block text-[14.5px]">{p!.name}</b>
                <span className="block text-[13px] text-muted">
                  {p!.bank} · <span className="tabular">{p!.accountNo}</span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => copy(p!.accountNo!)}
                className="h-[34px] shrink-0 rounded-lg border border-border bg-card px-3 text-[13px] font-bold text-ink"
              >
                {t.common.copy}
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {myList}
      {friend ? (adding ? billForm(false) : addButton("h-[42px] self-start px-4 text-[14px]")) : null}
      <div className="flex flex-wrap items-center gap-x-4 self-start">
        {history}
        {changeMe}
      </div>
    </>
  );

  return (
    <>
      <PrinterPage
        header={back ? <TopBar back={back} title={t.receipt.title} /> : undefined}
        side={side}
        phoneTop={adding ? undefined : myList}
        phoneBelow={
          <div className="flex flex-wrap justify-center gap-x-4">
            {history}
            {changeMe}
          </div>
        }
        panel={friend && adding ? billForm(true) : undefined}
        dock={
          friend && !adding ? addButton("h-12 w-full text-[15px] shadow-[0_4px_14px_rgba(55,53,47,0.10)]") : undefined
        }
        paper={
          <Receipt
            doc={bill.doc}
            payments={bill.payments}
            billId={bill.id}
            expiresAt={bill.expiresAt}
            sharedBy={sharedBy}
            preview={adding ? preview : null}
            freshItemId={freshId}
            hint={friend && summary.remaining.length > 0 ? t.friend.tapHint : undefined}
            onLine={
              friend
                ? (l) =>
                    withMe(() => {
                      setLine(l);
                      setOpen(true);
                    })
                : undefined
            }
          />
        }
      />
      {friend ? (
        <Sheet
          open={open || asking !== null}
          onOpenChange={(next) => {
            if (next) return;
            setOpen(false);
            setAsking(null);
          }}
          title={
            asking
              ? t.friend.whoTitle
              : line
                ? fmt(t.friend.confirmTitle, { from: nameOf(line.from), to: nameOf(line.to) })
                : ""
          }
        >
          {asking ? (
            <>
              <p className="m-0 text-[14px] text-muted">{t.friend.whoDesc}</p>
              <div className="flex flex-col gap-2">
                {bill.doc.people.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pick(p.id)}
                    className="flex h-12 items-center gap-2.5 rounded-xl bg-chip px-2.5 text-left text-[15px] font-bold text-ink"
                  >
                    <Avatar name={p.name} color={p.color} size={30} />
                    <span className="min-w-0 truncate">{p.name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => pick(NOT_LISTED)}
                  className="h-11 text-[15px] font-bold text-muted"
                >
                  {t.friend.notListed}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-[30px] font-extrabold tracking-[-0.02em] tabular">
                {line ? money(line.amount) : ""}
              </div>
              <p className="m-0 text-[14px] text-muted">{t.friend.confirmDesc}</p>
              <div className="flex flex-col gap-1.5 pt-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={confirm}
                  className="h-14 rounded-2xl bg-green text-[16px] font-bold text-white disabled:opacity-60"
                >
                  {t.track.markPaid}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="h-11 text-[15px] font-bold text-muted">
                  {t.friend.cancel}
                </button>
              </div>
            </>
          )}
        </Sheet>
      ) : null}
    </>
  );
}
