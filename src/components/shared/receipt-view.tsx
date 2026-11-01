"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addMemberItem,
  addMyName,
  addPayment,
  removeMemberItem,
  removePayment,
  saveMyBills,
  setMyDetails,
  type MyBillChanges,
} from "@/app/actions";
import { NameChip, NotListedChip } from "@/components/name-chip";
import { Header, TopBar } from "@/components/header";
import { BillForm } from "@/components/home/bill-form";
import { PlusIcon } from "@/components/icons";
import { dockButton, PrinterPage } from "@/components/receipt/printer";
import { Receipt } from "@/components/receipt/receipt";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { itemShares, ownerOf, summarize, type Item, type Person, type PlanLine, type PreviewItem } from "@/lib/bill";
import { getAsked, getMe, setAsked, setMe, useMe } from "@/lib/store";
import { BankForm } from "./bank-form";
import { Greeting } from "./greeting";
import { ChangesBanner, HistoryButton, useChangesSinceVisit } from "./history";
import { JoinForm } from "./join-form";
import { NameForm } from "./name-form";
import { PayForm } from "./pay-form";
import { ShareBill } from "./share-bill";
import type { SharedBillData } from "./shared-bill";

type View =
  | { kind: "add" }
  | { kind: "join" }
  | { kind: "pay"; from: string; to: string }
  | { kind: "name"; then: () => void }
  | { kind: "bank"; personId: string };

type Ask =
  | { kind: "who"; then: () => void; hide?: string | null; first?: boolean }
  | { kind: "confirm"; line: PlanLine }
  | { kind: "undo"; line: PlanLine };

export function ReceiptView({
  bill,
  sharedBy,
  back,
  quiet = false,
}: {
  bill: SharedBillData;
  sharedBy: string;
  back?: { label: string; onClick: () => void };
  quiet?: boolean;
}) {
  const { t, money, date } = useI18n();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [view, setView] = useState<View | null>(null);
  const [preview, setPreview] = useState<PreviewItem | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [newMe, setNewMe] = useState<Person | null>(null);
  const [tell, setTell] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const desktop = useIsDesktop();
  const { mine } = bill;
  const me = useMe(bill.id);

  const doc =
    newMe && !bill.doc.people.some((p) => p.id === newMe.id)
      ? { ...bill.doc, people: [...bill.doc.people, newMe] }
      : bill.doc;
  const nameOf = (id: string) => doc.people.find((p) => p.id === id)?.name ?? "?";
  const myName = doc.people.find((p) => p.id === me)?.name;
  const member = !back;
  const locked = Boolean(doc.locked);
  const owner = ownerOf(doc)?.name;
  const others = doc.people.filter((p) => p.id !== doc.ownerId);
  const canName = !locked || others.length > 0;

  const [ask, setAsk] = useState<Ask | null>(() =>
    member && canName && !myName && !quiet && !getAsked(bill.id)
      ? { kind: "who", then: () => undefined, first: true }
      : null,
  );
  const [asking, setAsking] = useState(ask !== null);

  useEffect(() => {
    if (ask?.kind === "who" && ask.first) setAsked(bill.id);
  }, [ask, bill.id]);

  const changes = useChangesSinceVisit(bill.id, bill.createdAt, bill.events, (e) => Boolean(me) && e.byPersonId === me);
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
  const tapLine = (line: PlanLine) => showAsk({ kind: line.paymentId ? "undo" : "confirm", line });
  const forgetMe = () => {
    setAsked(bill.id);
    setMe(bill.id, null);
    setAsking(false);
  };
  const openView = (next: View) =>
    requestAnimationFrame(() => {
      setView(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

  const summary = summarize(doc, bill.payments);

  const lineHint = () => {
    if (!member) return undefined;
    if (myName) return summary.remaining.some((l) => l.from === me) ? t.member.tapHint : undefined;
    return canName && summary.remaining.length > 0 ? t.member.chooseHint : undefined;
  };

  const receivers = [...new Set([...summary.remaining, ...summary.done].map((l) => l.to))]
    .map((id) => doc.people.find((p) => p.id === id))
    .filter((p) => p?.bank && p.accountNo);

  const errorText = (error: string, name = "") =>
    error === "rate_limited"
      ? t.member.tooMany
      : error === "locked"
        ? t.member.lockedError
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
      const result = await addPayment(bill.id, payment, { different });
      setAsking(false);
      if (!result.ok) return void toast({ message: errorText(result.error) });
      setView(null);
      const { id } = result.data;
      toast({
        message: fmt(t.member.marked, { name: nameOf(payment.to) }),
        action: { label: t.common.undo, onClick: () => unpay(id, payment) },
      });
    });

  const unpay = (paymentId: string, line: { from: string; to: string }) =>
    start(async () => {
      const result = await removePayment(bill.id, paymentId, { byId: line.from });
      setAsking(false);
      if (!result.ok) return void toast({ message: errorText(result.error) });
      toast({ message: fmt(t.track.unmarked, { from: nameOf(line.from), to: nameOf(line.to) }) });
    });

  const addItem = (item: Item, newPeople: readonly Person[] = []) =>
    start(async () => {
      const result = await addMemberItem(
        bill.id,
        item,
        getMe(bill.id),
        newPeople.map(({ id, name }) => ({ id, name })),
      );
      if (!result.ok) return void toast({ message: errorText(result.error, newPeople[0]?.name) });
      const { id } = result.data;
      setFreshId(id);
      setTell(true);
      toast({
        message: fmt(t.member.added, { name: item.name }),
        action: { label: t.common.undo, onClick: () => deleteItem({ ...item, id }) },
      });
    });

  const deleteItem = (item: Item) =>
    start(async () => {
      const result = await removeMemberItem(bill.id, item.id, getMe(bill.id));
      if (!result.ok) return void toast({ message: errorText(result.error) });
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
      const { person } = result.data;
      setMe(bill.id, person.id);
      setNewMe(person);
      setView(null);
      then();
    });

  const saveBills = (next: MyBillChanges, undo: MyBillChanges | null) =>
    start(async () => {
      const result = await saveMyBills(bill.id, getMe(bill.id), next);
      if (!result.ok) return void toast({ message: errorText(result.error) });
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
                    leave: [...undo.leave, ...next.join.map(({ itemId }) => ({ itemId }))],
                  },
                  null,
                ),
            }
          : undefined,
      });
    });

  const saveDetails = (personId: string, details: { bank: string | null; accountNo: string | null }) =>
    start(async () => {
      const result = await setMyDetails(bill.id, personId, details, getMe(bill.id));
      if (!result.ok) return void toast({ message: errorText(result.error) });
      setView(null);
      toast({ message: t.common.save });
    });

  const tellGroup = () => {
    const text = `${fmt(t.member.tellMessage, { who: myName ?? t.history.someone, title: bill.doc.title })} ${window.location.origin}/bill/${bill.id}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    setTell(false);
  };

  const tellCard =
    member && tell && !locked ? (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <span className="min-w-0 text-[13.5px] font-semibold">{t.member.tellTitle}</span>
        <span className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setTell(false)}
            className="h-[34px] px-1 text-[13px] font-bold text-muted"
          >
            {t.member.cancel}
          </button>
          <button
            type="button"
            onClick={tellGroup}
            className="h-[34px] rounded-lg bg-green px-3 text-[13px] font-bold text-white"
          >
            {t.member.tellSend}
          </button>
        </span>
      </div>
    ) : null;

  const lockedNote =
    member && locked ? (
      <p className="m-0 rounded-xl bg-chip px-3.5 py-2.5 text-[13.5px] font-semibold text-muted">
        {owner ? fmt(t.member.locked, { name: owner }) : t.member.lockedError}
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

  const myJoins = mine.joins.filter((j) => j.personId === me).map((j) => j.itemId);
  const myItems = member ? doc.items.filter((i) => i.addedAt && mine.items.includes(i.id)) : [];
  const joined = member && me ? doc.items.filter((i) => i.joins?.[me] && myJoins.includes(i.id)) : [];
  const names = member ? doc.people.filter((p) => mine.people.includes(p.id)) : [];
  const listCount = myItems.length + joined.length + names.length;
  const hasList = !locked && listCount > 0;
  const fromList = (then: () => void) => {
    setListOpen(false);
    requestAnimationFrame(() => withMe(then));
  };
  const myRows = (
    <div>
      {names.map((p) =>
        row(p.id, p.name, p.bank ? p.bank : t.member.noBank, t.member.bankDetails, () =>
          fromList(() => openView({ kind: "bank", personId: p.id })),
        ),
      )}
      {joined.map((item) =>
        row(
          `join-${item.id}`,
          item.name,
          fmt(t.join.youPay, { amount: money(itemShares(item)[me!] ?? 0) }),
          t.bill.change,
          () => fromList(() => openView({ kind: "join" })),
        ),
      )}
      {myItems.map((item) =>
        row(
          item.id,
          item.name,
          money(item.amountMinor),
          t.member.deleteMine,
          () => fromList(() => deleteItem(item)),
          true,
        ),
      )}
    </div>
  );
  const myList = hasList ? (
    <div className="rounded-2xl border border-border bg-card px-4 pt-3 pb-1">
      <span className="text-[11px] font-bold tracking-[0.06em] text-faint uppercase">{t.member.yours}</span>
      {myRows}
    </div>
  ) : null;

  const history = <HistoryButton doc={doc} events={bill.events} open={historyOpen} onOpenChange={showHistory} />;

  const greeting = (className?: string) =>
    member && myName ? (
      <Greeting
        name={myName}
        className={className}
        onChange={() => showAsk({ kind: "who", then: () => undefined, hide: me })}
      />
    ) : null;

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
            title={t.member.addTitle}
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
            own={myJoins}
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

  const canChange = member && !locked;
  const canJoin = myName ? doc.items.some((i) => !i.participants.includes(me!)) : doc.items.length > 0;

  const changeButtons = (className: string) => {
    const shape = `inline-flex items-center justify-center gap-1.5 rounded-xl font-bold whitespace-nowrap text-ink disabled:opacity-60 ${className}`;
    return (
      <>
        <button
          type="button"
          disabled={pending}
          onClick={() => withMe(() => openView({ kind: "add" }))}
          className={shape}
        >
          <PlusIcon size={16} />
          {t.home.nextBill}
        </button>
        {canJoin ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => withMe(() => openView({ kind: "join" }))}
            className={shape}
          >
            {t.member.joinBill}
          </button>
        ) : null}
      </>
    );
  };

  const askBody = () => {
    if (!ask) return null;
    switch (ask.kind) {
      case "who":
        return (
          <>
            <div className="flex flex-wrap gap-2">
              {others
                .filter((p) => p.id !== ask.hide)
                .map((p) => (
                  <NameChip key={p.id} name={p.name} color={p.color} onClick={() => pick(p.id)} />
                ))}
              {locked ? null : <NotListedChip onClick={notListed} />}
            </div>
            {ask.first || ask.hide ? (
              <button type="button" onClick={forgetMe} className="h-11 shrink-0 text-[15px] font-bold text-muted">
                {t.member.justLooking}
              </button>
            ) : null}
          </>
        );
      case "confirm": {
        const { line } = ask;
        return (
          <>
            <div className="text-[30px] font-extrabold tracking-[-0.02em] tabular">{money(line.amount)}</div>
            <p className="m-0 text-[14px] text-muted">{t.member.confirmDesc}</p>
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
                {t.member.cancel}
              </button>
            </div>
          </>
        );
      }
      case "undo": {
        const { line } = ask;
        return (
          <>
            <div className="text-[30px] font-extrabold tracking-[-0.02em] tabular">{money(line.amount)}</div>
            <p className="m-0 text-[14px] text-muted">{t.member.undoDesc}</p>
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => unpay(line.paymentId!, line)}
                className="h-14 rounded-2xl bg-chip text-[16px] font-bold text-ink disabled:opacity-60"
              >
                {t.track.markUnpaid}
              </button>
              <button type="button" onClick={() => setAsking(false)} className="h-11 text-[15px] font-bold text-muted">
                {t.member.cancel}
              </button>
            </div>
          </>
        );
      }
    }
  };

  const side = (
    <>
      {greeting()}
      <span className="text-[11px] font-bold tracking-[0.06em] text-faint uppercase">
        {sharedBy
          ? fmt(t.member.sharedLine, { name: sharedBy, date: date(bill.createdAt, { day: "numeric", month: "short" }) })
          : date(bill.createdAt, { day: "numeric", month: "short" })}
      </span>
      <h1 className="m-0 text-[30px] font-extrabold tracking-[-0.025em]">{bill.doc.title}</h1>
      {banner}
      {lockedNote}
      {tellCard}
      {receivers.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card px-4 pt-3 pb-1">
          <span className="text-[11px] font-bold tracking-[0.06em] text-faint uppercase">{t.member.payTo}</span>
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
      {view ? body(false) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 self-start">
        {canChange && !view ? (
          <div className="flex gap-2">{changeButtons("h-[42px] border border-border bg-card px-4 text-[14px]")}</div>
        ) : null}
        {history}
      </div>
    </>
  );

  return (
    <>
      <PrinterPage
        header={
          back ? (
            <TopBar back={back} title={t.receipt.title} action={<ShareBill bill={bill} />} />
          ) : (
            <Header action={<ShareBill bill={bill} />} />
          )
        }
        side={side}
        phoneTop={
          view ? undefined : (
            <>
              {myName || hasList ? (
                <div className="flex items-center justify-between gap-3 px-1">
                  {greeting("min-w-0")}
                  {hasList ? (
                    <button
                      type="button"
                      onClick={() => setListOpen(true)}
                      className="ml-auto h-9 shrink-0 text-[13.5px] font-bold text-green-ink"
                    >
                      {t.member.yours} · {listCount}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {banner}
              {lockedNote}
              {tellCard}
            </>
          )
        }
        phoneBelow={<div className="flex justify-center">{history}</div>}
        panel={member && view ? body(true) : undefined}
        dock={
          canChange && !view ? <div className="flex gap-2">{changeButtons(`flex-1 ${dockButton}`)}</div> : undefined
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
            hint={lineHint()}
            onHint={member && !myName ? () => showAsk({ kind: "who", then: () => undefined }) : undefined}
            onLine={member && myName ? tapLine : undefined}
            onlyFrom={me}
            canUndo={(line) => Boolean(line.paymentId && mine.payments.includes(line.paymentId))}
          />
        }
      />
      {member && !desktop ? (
        <Sheet open={listOpen && hasList} onOpenChange={setListOpen} title={t.member.yours}>
          {myRows}
        </Sheet>
      ) : null}
      {member ? (
        <Sheet
          open={asking}
          onOpenChange={setAsking}
          title={
            ask?.kind === "who"
              ? t.member.whoTitle
              : ask?.kind === "undo"
                ? fmt(t.member.undoTitle, { to: nameOf(ask.line.to) })
                : ask
                  ? fmt(t.member.confirmTitle, { from: nameOf(ask.line.from), to: nameOf(ask.line.to) })
                  : ""
          }
        >
          {askBody()}
        </Sheet>
      ) : null}
    </>
  );
}
