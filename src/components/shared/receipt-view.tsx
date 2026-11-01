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
import { TopBar } from "@/components/header";
import { BillForm } from "@/components/home/bill-form";
import { PlusIcon } from "@/components/icons";
import { dockButton, PrinterPage } from "@/components/receipt/printer";
import { PayQr } from "@/components/pay-qr";
import { Receipt, type ReceiptWord } from "@/components/receipt/receipt";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import {
  detailsOpenToName,
  joinShare,
  ownerOf,
  previewMyBills,
  previewPayment,
  summarize,
  type Item,
  type Person,
  type PlanLine,
  type PreviewItem,
} from "@/lib/bill";
import { getAsked, getMe, setAsked, setMe, useMe } from "@/lib/store";
import { cn } from "@/lib/utils";
import { BankForm } from "./bank-form";
import { Greeting } from "./greeting";
import { ChangesBanner, HistoryButton, useChangesSinceVisit } from "./history";
import { JoinForm, type JoinStart } from "./join-form";
import { NameForm } from "./name-form";
import { PanelHead } from "./panel-form";
import { PayForm } from "./pay-form";
import { ShareBill } from "./share-bill";
import type { SharedBillData } from "./shared-bill";

type View =
  | { kind: "add" }
  | { kind: "join"; start: JoinStart }
  | { kind: "pay"; from: string; to: string }
  | { kind: "name"; then: () => void }
  | { kind: "bank"; personId: string };

type Ask =
  | { kind: "who"; then: () => void; hide?: string | null; first?: boolean }
  | { kind: "confirm"; line: PlanLine }
  | { kind: "undo"; line: PlanLine }
  | { kind: "details"; personId: string };

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
  const [joinPreview, setJoinPreview] = useState<MyBillChanges | null>(null);
  const [payPreview, setPayPreview] = useState<Parameters<typeof previewPayment>[0] | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [newMe, setNewMe] = useState<Person | null>(null);
  const [tell, setTell] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
      setAsking(false);
      setView(next);
      if (next.kind !== "bank") window.scrollTo({ top: 0, behavior: "smooth" });
    });

  const summary = summarize(doc, bill.payments);

  const lineHint = () => {
    if (!member) return undefined;
    if (myName) return summary.remaining.some((l) => l.from === me) ? t.member.tapHint : undefined;
    return canName && summary.remaining.length > 0 ? t.member.chooseHint : undefined;
  };

  const errorText = (error: string, name = "") =>
    error === "rate_limited"
      ? t.member.tooMany
      : error === "locked"
        ? t.member.lockedError
        : error === "duplicate"
          ? fmt(t.home.duplicateName, { name })
          : error === "taken"
            ? t.member.detailsTaken
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

  const saveDetails = (
    personId: string,
    details: { bank: string | null; accountNo: string | null; payQr: string | null },
  ) =>
    start(async () => {
      const result = await setMyDetails(bill.id, personId, details, getMe(bill.id));
      if (!result.ok && result.error === "taken") setView(null);
      if (!result.ok) return void toast({ message: errorText(result.error) });
      setView(null);
      toast({ message: t.member.detailsSaved });
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

  const myJoins = mine.joins.filter((j) => j.personId === me).map((j) => j.itemId);
  const history = <HistoryButton doc={doc} events={bill.events} open={historyOpen} onOpenChange={showHistory} />;

  const greeting = (className?: string) =>
    member && myName ? (
      <Greeting
        name={myName}
        className={className}
        onChange={() => showAsk({ kind: "who", then: () => undefined, hide: me })}
      />
    ) : member && canName ? (
      <Greeting
        text={t.member.whoTitle}
        className={className}
        onChange={() => showAsk({ kind: "who", then: () => undefined })}
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
            start={view.start}
            bare={bare}
            pending={pending}
            onSave={saveBills}
            onCancel={close}
            onPreview={setJoinPreview}
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
            onPreview={setPayPreview}
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

  const addPreview = view?.kind === "add" ? preview : null;
  const previewing = addPreview ?? joinPreview ?? payPreview;
  const quietPaper = Boolean(view || previewing);
  const paperDoc = joinPreview && me ? previewMyBills(doc, me, joinPreview) : bill.doc;
  const changedItems = joinPreview
    ? [...joinPreview.join, ...joinPreview.change, ...joinPreview.leave].map((c) => c.itemId)
    : undefined;

  const canChange = member && !locked;

  const itemWord = (item: Item): ReceiptWord | null => {
    if (!canChange || !me || !myName || quietPaper) return null;
    if (item.addedAt && mine.items.includes(item.id))
      return {
        label: t.member.deleteMine,
        name: `${t.member.deleteMine} ${item.name}`,
        tone: "danger",
        disabled: pending,
        onClick: () => deleteItem(item),
      };
    if (item.joins?.[me] && myJoins.includes(item.id))
      return {
        label: `${t.bill.change} ›`,
        name: `${t.bill.change} ${item.name}`,
        onClick: () => openView({ kind: "join", start: { itemId: item.id, mode: "change" } }),
      };
    if (!item.participants.includes(me) && joinShare(item, me) !== null)
      return {
        label: `${t.member.join} ›`,
        name: `${t.member.join} ${item.name}`,
        tone: "go",
        onClick: () => openView({ kind: "join", start: { itemId: item.id, mode: "join" } }),
      };
    return null;
  };

  const hasAccount = (p: Person) => Boolean(p.bank && p.accountNo);
  const hasDetails = (p: Person) => Boolean(p.payQr) || hasAccount(p);
  const payToWord = (p: Person): ReceiptWord | null => {
    if (quietPaper) return null;
    const onThisName = p.id === me && detailsOpenToName(doc, p);
    if (canChange && myName && (mine.people.includes(p.id) || onThisName)) {
      const label = hasDetails(p) ? t.member.bankDetails : t.member.addBankDetails;
      return {
        label: `${label} ›`,
        name: `${label} ${p.name}`,
        tone: "go",
        onClick: () => openView({ kind: "bank", personId: p.id }),
      };
    }
    return hasDetails(p)
      ? {
          label: `${t.member.bankDetails} ›`,
          name: `${t.member.bankDetails} ${p.name}`,
          tone: "go",
          onClick: () => showAsk({ kind: "details", personId: p.id }),
        }
      : null;
  };

  const payDetails = (id: string) => {
    const person = doc.people.find((p) => p.id === id);
    if (!person) return null;
    return (
      <>
        {person.payQr ? <PayQr code={person.payQr} name={person.name} /> : null}
        {hasAccount(person) ? (
          <div className="flex items-center justify-between gap-3 border-y border-line py-2.5">
            <span className="min-w-0">
              <b className="block text-[14.5px]">{person.bank}</b>
              <span className="block text-[13px] text-muted tabular">{person.accountNo}</span>
            </span>
            <button
              type="button"
              onClick={() => copy(person.accountNo!)}
              className="h-[34px] shrink-0 rounded-lg border border-border bg-card px-3 text-[13px] font-bold text-ink"
            >
              {t.common.copy}
            </button>
          </div>
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
            {payDetails(line.to)}
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
      case "details":
        return payDetails(ask.personId);
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

  const askTitle =
    ask?.kind === "who"
      ? t.member.whoTitle
      : ask?.kind === "undo"
        ? fmt(t.member.undoTitle, { to: nameOf(ask.line.to) })
        : ask?.kind === "details"
          ? fmt(t.member.detailsOf, { name: nameOf(ask.personId) })
          : ask
            ? fmt(t.member.confirmTitle, { from: nameOf(ask.line.from), to: nameOf(ask.line.to) })
            : "";
  const askInPanel = desktop && asking && ask !== null && ask.kind !== "who";

  const addButton = (
    <button
      type="button"
      disabled={pending}
      onClick={() => withMe(() => openView({ kind: "add" }))}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-60",
        dockButton,
      )}
    >
      <PlusIcon size={16} />
      {t.home.nextBill}
    </button>
  );
  const actions = canChange ? (
    <div className="grid grid-cols-[1fr_1.3fr] gap-2">
      {addButton}
      <ShareBill bill={bill} label className="h-12 text-[15px]" />
    </div>
  ) : (
    <ShareBill bill={bill} label className="h-12 w-full text-[15px]" />
  );
  const topLine = (
    <div className="flex items-center justify-between gap-3">
      {greeting("min-w-0")}
      <span className="ml-auto shrink-0">{history}</span>
    </div>
  );

  const side = view ? (
    body(true)
  ) : askInPanel ? (
    <div className="flex flex-col gap-2.5">
      <PanelHead title={askTitle} onClose={() => setAsking(false)} />
      {askBody()}
    </div>
  ) : (
    <>
      {topLine}
      <div className="flex flex-col gap-0.5 pt-2">
        <h1 className="m-0 text-[30px] leading-[1.15] font-extrabold tracking-[-0.025em]">{bill.doc.title}</h1>
        <span className="text-[13px] text-muted">
          {sharedBy
            ? fmt(t.member.sharedLine, {
                name: sharedBy,
                date: date(bill.createdAt, { day: "numeric", month: "short" }),
              })
            : date(bill.createdAt, { day: "numeric", month: "short" })}
        </span>
      </div>
      {banner}
      {lockedNote}
      {tellCard}
      {actions}
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
              <div className="px-1">{topLine}</div>
              {banner}
              {lockedNote}
              {tellCard}
            </>
          )
        }
        panel={member && view ? body(true) : undefined}
        dock={view ? undefined : actions}
        follow={previewing ? JSON.stringify(previewing) : view?.kind === "join" ? "join" : undefined}
        paper={
          <Receipt
            doc={paperDoc}
            payments={payPreview ? [...bill.payments, previewPayment(payPreview)] : bill.payments}
            billId={bill.id}
            expiresAt={bill.expiresAt}
            sharedBy={sharedBy}
            preview={addPreview}
            changed={changedItems}
            freshItemId={freshId}
            hint={quietPaper ? undefined : lineHint()}
            onHint={member && !myName ? () => showAsk({ kind: "who", then: () => undefined }) : undefined}
            onLine={member && myName && !quietPaper ? tapLine : undefined}
            onlyFrom={me}
            canUndo={(line) => Boolean(line.paymentId && mine.payments.includes(line.paymentId))}
            itemWord={itemWord}
            payToWord={payToWord}
          />
        }
      />
      <Sheet open={asking && !askInPanel} onOpenChange={setAsking} title={askTitle}>
        {askBody()}
      </Sheet>
    </>
  );
}
