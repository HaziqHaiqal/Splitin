"use client";

import { useState, useTransition } from "react";
import {
  addFriendItem,
  addMyName,
  addPayment,
  removeFriendItem,
  removePayment,
  saveMyBills,
  setMyDetails,
  type MyBillChanges,
} from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { TopBar } from "@/components/header";
import { BillForm } from "@/components/home/bill-form";
import { PlusIcon } from "@/components/icons";
import { PrinterPage } from "@/components/receipt/printer";
import { Receipt } from "@/components/receipt/receipt";
import { Sheet, SheetOption } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { itemShares, ownerOf, summarize, type Item, type Person, type PlanLine, type PreviewItem } from "@/lib/bill";
import { getMe, setMe, setMyItem, setMyJoin, setMyName, useMe, useMyItems, useMyJoins, useMyNames } from "@/lib/store";
import { BankForm } from "./bank-form";
import { ChangesBanner, HistoryButton, useChangesSinceVisit } from "./history";
import { JoinForm } from "./join-form";
import { NameForm } from "./name-form";
import { PayForm } from "./pay-form";
import type { SharedBillData } from "./shared-bill";

type View =
  | { kind: "add" }
  | { kind: "join" }
  | { kind: "pay"; from: string; to: string }
  | { kind: "name"; then: () => void }
  | { kind: "bank"; personId: string };

type Ask =
  { kind: "who"; then: () => void; hide?: string | null } | { kind: "choose" } | { kind: "confirm"; line: PlanLine };

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
  const [ask, setAsk] = useState<Ask | null>(null);
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const [view, setView] = useState<View | null>(null);
  const [preview, setPreview] = useState<PreviewItem | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [newMe, setNewMe] = useState<Person | null>(null);
  const [tell, setTell] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const desktop = useIsDesktop();
  const mine = useMyItems(bill.id);
  const myJoins = useMyJoins(bill.id);
  const myNames = useMyNames(bill.id);
  const me = useMe(bill.id);

  const doc =
    newMe && !bill.doc.people.some((p) => p.id === newMe.id)
      ? { ...bill.doc, people: [...bill.doc.people, newMe] }
      : bill.doc;
  const nameOf = (id: string) => doc.people.find((p) => p.id === id)?.name ?? "?";
  const myName = doc.people.find((p) => p.id === me)?.name;
  const friend = !back;
  const locked = Boolean(doc.locked);
  const owner = ownerOf(doc)?.name;

  const changes = useChangesSinceVisit(bill.id, bill.createdAt, bill.events, (e) => Boolean(myName) && e.by === myName);
  const showHistory = (next: boolean) => {
    if (next) changes.clear();
    setHistoryOpen(next);
  };

  const showAsk = (next: Ask) => {
    setAsk(next);
    setAsking(true);
  };
  const withMe = (then: () => void) => (myName ? then() : showAsk({ kind: "who", then }));
  const pick = (id: string) => {
    setMe(bill.id, id);
    setAsking(false);
    if (ask?.kind === "who") ask.then();
  };
  const notListed = () => {
    const then = ask?.kind === "who" ? ask.then : () => undefined;
    setAsking(false);
    requestAnimationFrame(() => setView({ kind: "name", then }));
  };
  const forgetMe = () => {
    setMe(bill.id, null);
    setAsking(false);
  };
  const openView = (next: View) =>
    requestAnimationFrame(() => {
      setView(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  const choose = (kind: "add" | "join") => {
    setAsking(false);
    withMe(() => openView({ kind }));
  };

  const summary = summarize(doc, bill.payments);

  const receivers = [...new Set([...summary.remaining, ...summary.done].map((l) => l.to))]
    .map((id) => doc.people.find((p) => p.id === id))
    .filter((p) => p?.bank && p.accountNo);

  const errorText = (error: string, name = "") =>
    error === "rate_limited"
      ? t.friend.tooMany
      : error === "locked"
        ? t.friend.lockedError
        : error === "duplicate"
          ? fmt(t.home.duplicateName, { name })
          : t.common.generic;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text.replace(/\s+/g, ""));
      toast({ message: t.common.copied });
    } catch {
      toast({ message: t.common.generic });
    }
  };

  const pay = (payment: { from: string; to: string; amountMinor: number }, different: boolean) =>
    start(async () => {
      const byId = getMe(bill.id);
      const result = await addPayment(bill.id, payment, { byId, different });
      setAsking(false);
      if (!result.ok) return void toast({ message: errorText(result.error) });
      setView(null);
      const { id, undoKey } = result.data;
      toast({
        message: fmt(t.friend.marked, { name: nameOf(payment.to) }),
        action: {
          label: t.common.undo,
          onClick: () => void removePayment(bill.id, id, { undoKey, byId: getMe(bill.id) }),
        },
      });
    });

  const addItem = (item: Item, newPeople: readonly Person[] = []) =>
    start(async () => {
      const result = await addFriendItem(
        bill.id,
        item,
        getMe(bill.id),
        newPeople.map(({ id, name }) => ({ id, name })),
      );
      if (!result.ok) return void toast({ message: errorText(result.error, newPeople[0]?.name) });
      const { id, token } = result.data;
      setMyItem(bill.id, id, token);
      for (const p of newPeople) setMyName(bill.id, p.id, token);
      setFreshId(id);
      setTell(true);
      toast({
        message: fmt(t.friend.added, { name: item.name }),
        action: { label: t.common.undo, onClick: () => deleteItem({ ...item, id }, token) },
      });
    });

  const deleteItem = (item: Item, token: string) =>
    start(async () => {
      const result = await removeFriendItem(bill.id, item.id, token, getMe(bill.id));
      if (!result.ok) return void toast({ message: errorText(result.error) });
      setMyItem(bill.id, item.id, null);
      setTell(true);
      toast({
        message: fmt(t.bill.deleted, { name: item.name }),
        action: { label: t.common.undo, onClick: () => addItem(item) },
      });
    });

  const saveName = (name: string, then: () => void) =>
    start(async () => {
      const result = await addMyName(bill.id, name);
      if (!result.ok) return void toast({ message: errorText(result.error, name) });
      const { person, key } = result.data;
      setMyName(bill.id, person.id, key);
      setMe(bill.id, person.id);
      setNewMe(person);
      setView(null);
      then();
    });

  const saveBills = (next: MyBillChanges, undo: MyBillChanges | null) =>
    start(async () => {
      const result = await saveMyBills(bill.id, getMe(bill.id), next);
      if (!result.ok) return void toast({ message: errorText(result.error) });
      for (const { itemId } of next.join) setMyJoin(bill.id, itemId, result.data.token);
      for (const { itemId } of next.leave) setMyJoin(bill.id, itemId, null);
      setView(null);
      setTell(true);
      toast({
        message: t.join.saved,
        action: undo
          ? {
              label: t.common.undo,
              onClick: () =>
                saveBills(
                  {
                    ...undo,
                    leave: [...undo.leave, ...next.join.map(({ itemId }) => ({ itemId, token: result.data.token }))],
                  },
                  null,
                ),
            }
          : undefined,
      });
    });

  const saveDetails = (personId: string, details: { bank: string | null; accountNo: string | null }) =>
    start(async () => {
      const result = await setMyDetails(bill.id, personId, myNames[personId], details, getMe(bill.id));
      if (!result.ok) return void toast({ message: errorText(result.error) });
      setView(null);
      toast({ message: t.common.save });
    });

  const tellGroup = () => {
    const text = `${fmt(t.friend.tellMessage, { who: myName ?? t.history.friend, title: bill.doc.title })} ${window.location.origin}/bill/${bill.id}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    setTell(false);
  };

  const tellCard =
    friend && tell && !locked ? (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <span className="min-w-0 text-[13.5px] font-semibold">{t.friend.tellTitle}</span>
        <span className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setTell(false)}
            className="h-[34px] px-1 text-[13px] font-bold text-muted"
          >
            {t.friend.cancel}
          </button>
          <button
            type="button"
            onClick={tellGroup}
            className="h-[34px] rounded-lg bg-green px-3 text-[13px] font-bold text-white"
          >
            {t.friend.tellSend}
          </button>
        </span>
      </div>
    ) : null;

  const lockedNote =
    friend && locked ? (
      <p className="m-0 rounded-xl bg-chip px-3.5 py-2.5 text-[13.5px] font-semibold text-muted">
        {owner ? fmt(t.friend.locked, { name: owner }) : t.friend.lockedError}
      </p>
    ) : null;

  const banner = <ChangesBanner count={changes.count} onShow={() => showHistory(true)} />;

  const row = (key: string, name: string, detail: string, button: string, onClick: () => void, danger = false) => (
    <div key={key} className="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
      <span className="min-w-0 truncate">
        <b className="text-[14.5px]">{name}</b>
        <span className="text-[13px] text-muted"> · {detail}</span>
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className={`h-[34px] shrink-0 rounded-lg border border-border bg-card px-3 text-[13px] font-bold disabled:opacity-60 ${danger ? "text-owe" : "text-ink"}`}
      >
        {button}
      </button>
    </div>
  );

  const myItems = friend ? doc.items.filter((i) => i.deleteHash && mine[i.id]) : [];
  const joined = friend && me ? doc.items.filter((i) => i.joins?.[me] && myJoins[i.id]) : [];
  const names = friend ? doc.people.filter((p) => myNames[p.id]) : [];
  const hasList = !locked && myItems.length + joined.length + names.length > 0;
  const myList = hasList ? (
    <div className="rounded-2xl border border-border bg-card px-4 pt-3 pb-1">
      <span className="text-[11px] font-bold tracking-[0.06em] text-faint uppercase">{t.friend.yours}</span>
      <div>
        {names.map((p) =>
          row(p.id, p.name, p.bank ? p.bank : t.friend.noBank, t.friend.bankDetails, () =>
            withMe(() => openView({ kind: "bank", personId: p.id })),
          ),
        )}
        {joined.map((item) =>
          row(
            `join-${item.id}`,
            item.name,
            fmt(t.join.youPay, { amount: money(itemShares(item)[me!] ?? 0) }),
            t.bill.change,
            () => withMe(() => openView({ kind: "join" })),
          ),
        )}
        {myItems.map((item) =>
          row(
            item.id,
            item.name,
            money(item.amountMinor),
            t.friend.deleteMine,
            () => withMe(() => deleteItem(item, mine[item.id])),
            true,
          ),
        )}
      </div>
    </div>
  ) : null;

  const history = <HistoryButton doc={doc} events={bill.events} open={historyOpen} onOpenChange={showHistory} />;

  const changeMe =
    friend && myName ? (
      <button
        type="button"
        onClick={() => showAsk({ kind: "who", then: () => undefined, hide: me })}
        className="h-9 text-[13.5px] font-bold text-muted"
      >
        {fmt(t.friend.notYou, { name: myName })}
      </button>
    ) : null;

  const links = (
    <>
      {history}
      {changeMe}
    </>
  );

  const body = (bare: boolean) => {
    if (!view) return null;
    const close = () => setView(null);
    switch (view.kind) {
      case "add":
        return (
          <BillForm
            item={null}
            doc={doc}
            first={false}
            bare={bare}
            autoFocus={desktop}
            title={t.friend.addTitle}
            defaultPaidBy={myName ? (me ?? undefined) : undefined}
            onAdd={addItem}
            onPrinted={close}
            onCancel={close}
            onPreview={setPreview}
          />
        );
      case "join":
        return (
          <JoinForm
            doc={doc}
            me={me ?? ""}
            tokens={myJoins}
            bare={bare}
            pending={pending}
            onSave={saveBills}
            onCancel={close}
          />
        );
      case "pay":
        return (
          <PayForm
            doc={doc}
            fixed={view}
            bare={bare}
            autoFocus={desktop}
            pending={pending}
            onSave={(payment) => pay(payment, true)}
            onCancel={close}
          />
        );
      case "name":
        return (
          <NameForm
            bare={bare}
            autoFocus={desktop}
            pending={pending}
            onSave={(name) => saveName(name, view.then)}
            onCancel={close}
          />
        );
      case "bank": {
        const person = doc.people.find((p) => p.id === view.personId);
        return person ? (
          <BankForm
            person={person}
            bare={bare}
            pending={pending}
            onSave={(details) => saveDetails(person.id, details)}
            onCancel={close}
          />
        ) : null;
      }
    }
  };

  const canChange = friend && !locked;
  const canJoin = doc.items.length > 0;

  const changeButton = (className: string) => (
    <button
      type="button"
      disabled={pending}
      onClick={() => (canJoin ? showAsk({ kind: "choose" }) : withMe(() => openView({ kind: "add" })))}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card font-bold whitespace-nowrap text-ink disabled:opacity-60 ${className}`}
    >
      <PlusIcon size={16} />
      {canJoin ? t.friend.addOrJoin : t.friend.addPaid}
    </button>
  );

  const askBody = () => {
    if (!ask) return null;
    switch (ask.kind) {
      case "who":
        return (
          <>
            <p className="m-0 text-[14px] text-muted">{t.friend.whoDesc}</p>
            <div className="flex flex-col gap-2">
              {doc.people
                .filter((p) => p.id !== doc.ownerId && p.id !== ask.hide)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pick(p.id)}
                    className="flex h-12 shrink-0 items-center gap-2.5 rounded-xl bg-chip px-2.5 text-left text-[15px] font-bold text-ink"
                  >
                    <Avatar name={p.name} color={p.color} size={30} />
                    <span className="min-w-0 truncate">{p.name}</span>
                  </button>
                ))}
              {locked ? null : (
                <button type="button" onClick={notListed} className="h-11 text-[15px] font-bold text-muted">
                  {t.friend.notListed}
                </button>
              )}
              {ask.hide ? (
                <button type="button" onClick={forgetMe} className="h-11 text-[15px] font-bold text-muted">
                  {t.friend.clearMe}
                </button>
              ) : null}
            </div>
          </>
        );
      case "choose":
        return (
          <div className="flex flex-col gap-2">
            <SheetOption title={t.friend.addPaid} desc={t.friend.addPaidDesc} onClick={() => choose("add")} />
            <SheetOption title={t.friend.joinBill} desc={t.friend.joinBillDesc} onClick={() => choose("join")} />
          </div>
        );
      case "confirm": {
        const { line } = ask;
        return (
          <>
            <div className="text-[30px] font-extrabold tracking-[-0.02em] tabular">{money(line.amount)}</div>
            <p className="m-0 text-[14px] text-muted">{t.friend.confirmDesc}</p>
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => pay({ from: line.from, to: line.to, amountMinor: line.amount }, false)}
                className="h-14 rounded-2xl bg-green text-[16px] font-bold text-white disabled:opacity-60"
              >
                {t.track.markPaid}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAsking(false);
                  openView({ kind: "pay", from: line.from, to: line.to });
                }}
                className="h-11 text-[15px] font-bold text-green-ink"
              >
                {t.pay.different}
              </button>
              <button type="button" onClick={() => setAsking(false)} className="h-11 text-[15px] font-bold text-muted">
                {t.friend.cancel}
              </button>
            </div>
          </>
        );
      }
    }
  };

  const side = (
    <>
      <span className="text-[11px] font-bold tracking-[0.06em] text-faint uppercase">
        {sharedBy
          ? fmt(t.friend.sharedLine, { name: sharedBy, date: date(bill.createdAt, { day: "numeric", month: "short" }) })
          : date(bill.createdAt, { day: "numeric", month: "short" })}
      </span>
      <h1 className="m-0 text-[30px] font-extrabold tracking-[-0.025em]">{bill.doc.title}</h1>
      {banner}
      {friend && summary.remaining.length > 0 ? (
        <p className="m-0 max-w-[46ch] text-[14.5px] leading-[1.5] text-muted">{t.friend.findYours}</p>
      ) : null}
      {lockedNote}
      {tellCard}
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
      {view ? body(false) : canChange ? changeButton("h-[42px] self-start px-4 text-[14px]") : null}
      <div className="flex flex-wrap items-center gap-x-4 self-start">{links}</div>
    </>
  );

  return (
    <>
      <PrinterPage
        header={back ? <TopBar back={back} title={t.receipt.title} /> : undefined}
        side={side}
        phoneTop={
          view ? undefined : (
            <>
              {banner}
              {lockedNote}
              {tellCard}
              {myList}
            </>
          )
        }
        phoneBelow={<div className="flex flex-wrap justify-center gap-x-4">{links}</div>}
        panel={friend && view ? body(true) : undefined}
        dock={
          canChange && !view
            ? changeButton("h-12 w-full text-[14.5px] shadow-[0_4px_14px_rgba(55,53,47,0.10)]")
            : undefined
        }
        paper={
          <Receipt
            doc={bill.doc}
            payments={bill.payments}
            billId={bill.id}
            expiresAt={bill.expiresAt}
            sharedBy={sharedBy}
            preview={view?.kind === "add" ? preview : null}
            freshItemId={freshId}
            hint={friend && summary.remaining.length > 0 ? t.friend.tapHint : undefined}
            onLine={friend ? (line) => withMe(() => showAsk({ kind: "confirm", line })) : undefined}
          />
        }
      />
      {friend ? (
        <Sheet
          open={asking}
          onOpenChange={setAsking}
          title={
            ask?.kind === "who"
              ? t.friend.whoTitle
              : ask?.kind === "choose"
                ? t.friend.chooseTitle
                : ask
                  ? fmt(t.friend.confirmTitle, { from: nameOf(ask.line.from), to: nameOf(ask.line.to) })
                  : ""
          }
        >
          {askBody()}
        </Sheet>
      ) : null}
    </>
  );
}
