"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import {
  addMemberItem,
  addMyName,
  addPayment,
  editMemberItem,
  newOwnerLink,
  removeMemberItem,
  removePayment,
  renameMe,
  saveMyBills,
  saveOwnerEdit,
  setBillLock,
  setMyDetails,
  type MyBillChanges,
} from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { BillForm } from "@/components/home/bill-form";
import {
  BankIcon,
  CalculatorIcon,
  ChevronDownIcon,
  ClockIcon,
  LinkIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  ReceiptIcon,
  ResetIcon,
} from "@/components/icons";
import { NameChip, NotListedChip, PickOrType } from "@/components/name-chip";
import { PayQr } from "@/components/pay-qr";
import { PrinterPage } from "@/components/receipt/printer";
import { Receipt, type ReceiptWord } from "@/components/receipt/receipt";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import {
  detailsOpenToName,
  itemShares,
  joinShare,
  latestMemberChange,
  leaveItem,
  ownerOf,
  previewMyBills,
  previewPayment,
  repeatedName,
  summarize,
  withItem,
  withoutPerson,
  withShare,
  type BillDoc,
  type Item,
  type Person,
  type PlanLine,
  type PreviewItem,
} from "@/lib/bill";
import { nameFitsQr, qrFileName, readQrDetails } from "@/lib/pay-qr";
import { getAsked, getMe, setAsked, setMe, setOwnerToken, useMe } from "@/lib/store";
import { cn, newId } from "@/lib/utils";
import { BankForm } from "./bank-form";
import { IconTile, MenuFab, MenuItem, MenuPills, MenuRow, Rise, type Tile } from "./bill-menu";
import { Greeting } from "./greeting";
import { HistoryList, useChangesSinceVisit } from "./history";
import { BillDetail, BillRows, NameBody, type BillRules } from "./my-bills";
import { NameForm } from "./name-form";
import { PanelBack, PanelHead } from "./panel-form";
import { PayForm } from "./pay-form";
import { PeopleForm, type PeopleChange } from "./people-form";
import { ShareCard, useShareBill } from "./share-bill";
import { Workings } from "./workings";
import type { SharedBillData } from "./shared-bill";

type View =
  | { kind: "add" }
  | { kind: "edit"; itemId: string }
  | { kind: "pay"; from: string; to: string }
  | { kind: "name"; then: () => void }
  | { kind: "bank"; personId: string; back?: boolean }
  | { kind: "people" }
  | { kind: "how" }
  | { kind: "history" };

type Ask =
  | { kind: "who"; then: () => void; hide?: string | null; first?: boolean; back?: boolean }
  | { kind: "confirm"; line: PlanLine }
  | { kind: "undo"; line: PlanLine }
  | { kind: "details"; personId: string }
  | { kind: "me" }
  | { kind: "myName"; back?: boolean }
  | { kind: "owner"; back?: boolean };

type Menu = "root" | "bills" | "history" | `bill:${string}`;

type Done = { ok: true } | { ok: false; error: string };

const peopleOnly = (people: readonly Person[]) => people.map(({ id, name, color }) => ({ id, name, color }));

export function BillPage({
  bill,
  owner,
  ownerToken,
  quiet = false,
}: {
  bill: SharedBillData;
  owner: boolean;
  ownerToken: string | null;
  quiet?: boolean;
}) {
  const { t, money, date, time } = useI18n();
  const toast = useToast();
  const desktop = useIsDesktop();
  const [pending, start] = useTransition();
  const [shown, setShown] = useOptimistic(bill.doc);
  const [view, setView] = useState<View | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [openBill, setOpenBill] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewItem | null>(null);
  const [payPreview, setPayPreview] = useState<Parameters<typeof previewPayment>[0] | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [newMe, setNewMe] = useState<Person | null>(null);
  const [tell, setTell] = useState(false);
  const share = useShareBill(bill);
  const storedMe = useMe(bill.id);
  const { mine } = bill;

  const doc =
    newMe && !shown.people.some((p) => p.id === newMe.id) ? { ...shown, people: [...shown.people, newMe] } : shown;
  const ownerPerson = ownerOf(doc);
  const ownerName = ownerPerson?.name ?? t.history.owner;
  const me = owner
    ? (ownerPerson?.id ?? null)
    : storedMe && doc.people.some((p) => p.id === storedMe && p.id !== doc.ownerId)
      ? storedMe
      : null;
  const nameOf = (id: string) => doc.people.find((p) => p.id === id)?.name ?? "?";
  const myName = doc.people.find((p) => p.id === me)?.name;
  const locked = Boolean(doc.locked);
  const others = doc.people.filter((p) => p.id !== doc.ownerId);
  const canName = !owner && (!locked || others.length > 0);
  const named = owner || Boolean(myName);
  const lockedText = ownerPerson ? fmt(t.member.locked, { name: ownerName }) : t.member.lockedError;

  const [ask, setAsk] = useState<Ask | null>(() => {
    if (quiet) return null;
    if (owner) return ownerPerson || getAsked(bill.id) ? null : { kind: "owner" };
    return canName && !myName && (!getAsked(bill.id) || storedMe)
      ? { kind: "who", then: () => undefined, first: true }
      : null;
  });
  const [asking, setAsking] = useState(ask !== null);

  useEffect(() => {
    if ((ask?.kind === "who" && ask.first) || ask?.kind === "owner") setAsked(bill.id);
  }, [ask, bill.id]);

  const changes = useChangesSinceVisit(bill.id, bill.createdAt, bill.events, (e) =>
    owner ? e.byRole === "owner" : Boolean(me) && e.byPersonId === me,
  );
  const [backTo, setBackTo] = useState<Menu | null>(null);

  const showAsk = (next: Ask) => {
    setMenu(null);
    setAsk(next);
    setAsking(true);
  };
  const withMe = (then: () => void) => (named ? then() : showAsk({ kind: "who", then }));
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
  const openView = (next: View, from?: Menu) =>
    requestAnimationFrame(() => {
      setAsking(false);
      setMenu(null);
      setOpenBill(null);
      setBackTo(desktop ? null : (from ?? null));
      setView(next);
      if (next.kind !== "bank") window.scrollTo({ top: 0, behavior: "smooth" });
    });

  const summary = summarize(doc, bill.payments);

  const errorText = (error: string, name = "") =>
    error === "rate_limited"
      ? t.member.tooMany
      : error === "locked"
        ? t.member.lockedError
        : error === "duplicate"
          ? fmt(t.home.duplicateName, { name })
          : error === "taken"
            ? t.member.detailsTaken
            : error === "owner_name"
              ? t.member.ownerName
              : error === "has_payment"
                ? t.page.removedPaid
                : t.common.generic;

  const copy = async (text: string, message = t.common.copied) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ message });
    } catch {
      toast({ message: t.common.generic });
    }
  };

  const run = (action: () => Promise<Done>, optimistic: BillDoc | null, done: () => void, name = "") =>
    start(async () => {
      if (optimistic) setShown(optimistic);
      const result = await action();
      if (!result.ok) return void toast({ message: errorText(result.error, name) });
      done();
    });

  const ownerSave = (change: (doc: BillDoc) => BillDoc, message: string, undo?: () => void, then?: () => void) =>
    start(async () => {
      const base = bill.doc;
      const next = change(base);
      setShown(next);
      const result = await saveOwnerEdit(bill.id, ownerToken, next, latestMemberChange(base));
      const changedName = next.people.find((p) => base.people.find((q) => q.id === p.id)?.name !== p.name)?.name;
      if (!result.ok) return void toast({ message: errorText(result.error, repeatedName(next) ?? changedName) });
      then?.();
      setTell(true);
      toast({ message, action: undo ? { label: t.common.undo, onClick: undo } : undefined });
    });

  const pay = (payment: { from: string; to: string; amountMinor: number }, different: boolean) =>
    start(async () => {
      const result = await addPayment(bill.id, payment, owner ? { ownerToken } : { different, byId: me });
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
      const result = await removePayment(bill.id, paymentId, owner ? { ownerToken } : { byId: me ?? line.from });
      setAsking(false);
      if (!result.ok) return void toast({ message: errorText(result.error) });
      toast({ message: fmt(t.track.unmarked, { from: nameOf(line.from), to: nameOf(line.to) }) });
    });

  const send = async (text: string) => {
    if (!navigator.share) return copy(text);
    try {
      await navigator.share({ text });
    } catch {}
  };

  const remind = (line: PlanLine) => {
    setAsking(false);
    void send(
      `${fmt(t.track.remindMessage, { from: nameOf(line.from), title: doc.title, to: nameOf(line.to), amount: money(line.amount) })} ${window.location.origin}/bill/${bill.id}`,
    );
  };

  const addItem = (item: Item, newPeople: readonly Person[] = []) => {
    if (owner)
      return ownerSave(
        (d) => ({
          ...d,
          people: [...d.people, ...peopleOnly(newPeople.filter((p) => !d.people.some((q) => q.id === p.id)))],
          items: [...d.items, item],
        }),
        fmt(t.member.added, { name: item.name }),
        () => deleteItem(item),
        () => setFreshId(item.id),
      );
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
  };

  const deleteItem = (item: Item) => {
    if (owner) {
      const index = bill.doc.items.findIndex((i) => i.id === item.id);
      const restored = { ...item };
      delete restored.addedAt;
      return ownerSave(
        (d) => ({ ...d, items: d.items.filter((i) => i.id !== item.id) }),
        fmt(t.bill.deleted, { name: item.name }),
        () =>
          ownerSave(
            (d) => {
              if (d.items.some((i) => i.id === item.id)) return d;
              const items = [...d.items];
              items.splice(index < 0 ? items.length : index, 0, restored);
              return { ...d, items };
            },
            fmt(t.member.added, { name: item.name }),
          ),
      );
    }
    const base = bill.doc;
    run(
      () => removeMemberItem(bill.id, item.id, getMe(bill.id)),
      { ...base, items: base.items.filter((i) => i.id !== item.id) },
      () => {
        setTell(true);
        toast({
          message: fmt(t.bill.deleted, { name: item.name }),
          action: { label: t.common.undo, onClick: () => addItem(item) },
        });
      },
    );
  };

  const saveItem = (old: Item, next: Item, newPeople: readonly Person[]) => {
    const item = old.addedAt ? { ...next, addedAt: old.addedAt } : next;
    const message = fmt(t.page.itemSaved, { name: item.name });
    if (owner)
      return ownerSave(
        (d) =>
          withItem(
            {
              ...d,
              people: [...d.people, ...peopleOnly(newPeople.filter((p) => !d.people.some((q) => q.id === p.id)))],
            },
            item,
          ),
        message,
        () => ownerSave((d) => withItem(d, old), message),
      );
    run(
      () =>
        editMemberItem(
          bill.id,
          next,
          me,
          newPeople.map(({ id, name }) => ({ id, name })),
        ),
      newPeople.length > 0 ? null : withItem(bill.doc, item),
      () => {
        setTell(true);
        toast({ message, action: { label: t.common.undo, onClick: () => saveItem(item, old, []) } });
      },
      newPeople[0]?.name,
    );
  };

  const replaceItem = (old: Item, next: Item, message: string) => {
    if (owner)
      return ownerSave(
        (d) => withItem(d, next),
        message,
        () => ownerSave((d) => withItem(d, old), t.join.saved),
      );
    run(
      () => editMemberItem(bill.id, next, me),
      withItem(bill.doc, next),
      () => {
        setTell(true);
        toast({ message, action: { label: t.common.undo, onClick: () => replaceItem(next, old, t.join.saved) } });
      },
    );
  };

  const myBills = (next: MyBillChanges, message: string, undo?: MyBillChanges) => {
    if (!me) return;
    run(
      () => saveMyBills(bill.id, me, next),
      previewMyBills(bill.doc, me, next),
      () => {
        setTell(true);
        toast({
          message,
          action: undo ? { label: t.common.undo, onClick: () => myBills(undo, t.join.saved) } : undefined,
        });
      },
    );
  };

  const myJoins = new Set(mine.joins.filter((j) => j.personId === me).map((j) => j.itemId));
  const ownJoin = (item: Item) => Boolean(me && item.joins?.[me] && myJoins.has(item.id));
  const ownItem = (item: Item) => Boolean(item.addedAt && mine.items.includes(item.id));
  const rules: BillRules = {
    canPart: (item) => owner || (!locked && (ownJoin(item) || ownItem(item))),
    canEdit: (item) => owner || (!locked && ownItem(item)),
    dim: (item) =>
      !owner && (locked || (Boolean(me && item.participants.includes(me)) && !ownJoin(item) && !ownItem(item))),
  };

  const toggleBill = (item: Item) => {
    if (pending) return;
    if (!me) return withMe(() => undefined);
    if (locked && !owner) return toast({ message: fmt(t.page.lockedBills, { name: ownerName }) });
    const none: MyBillChanges = { join: [], change: [], leave: [] };
    if (!item.participants.includes(me)) {
      const amount = joinShare(item, me);
      if (amount === null) return toast({ message: fmt(t.join.full, { name: ownerName }) });
      const message = fmt(t.page.joined, { name: item.name, amount: money(amount) });
      if (owner) return replaceItem(item, withShare(item, me, undefined)!, message);
      return myBills({ ...none, join: [{ itemId: item.id }] }, message, { ...none, leave: [{ itemId: item.id }] });
    }
    if (!rules.canPart(item)) return toast({ message: fmt(t.page.cantLeave, { name: ownerName }) });
    const next = leaveItem(item, me);
    if (!next)
      return toast({
        message: item.participants.length === 1 ? fmt(t.page.onlyOne, { name: item.name }) : t.common.generic,
      });
    const message = fmt(t.page.left, { name: item.name });
    if (owner || !ownJoin(item)) return replaceItem(item, next, message);
    myBills({ ...none, leave: [{ itemId: item.id }] }, message, {
      ...none,
      join: [{ itemId: item.id, written: item.overrides[me] }],
    });
  };

  const backToBills = () => {
    setOpenBill(null);
    setMenu((m) => (m?.startsWith("bill:") ? "bills" : m));
  };

  const setPart = (item: Item, written: number | undefined) => {
    if (!me || pending) return;
    const next = withShare(item, me, written);
    if (!next) return toast({ message: t.join.tooMuch });
    backToBills();
    if (next.overrides[me] === item.overrides[me]) return;
    const message =
      written === undefined
        ? fmt(t.page.equalAgain, { name: item.name })
        : fmt(t.page.partSaved, { name: item.name, amount: money(itemShares(next)[me] ?? 0) });
    if (owner || !ownJoin(item)) return replaceItem(item, next, message);
    const none: MyBillChanges = { join: [], change: [], leave: [] };
    myBills({ ...none, change: [{ itemId: item.id, written }] }, message, {
      ...none,
      change: [{ itemId: item.id, written: item.overrides[me] }],
    });
  };

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

  const meRow = doc.people.find((p) => p.id === me);

  const renameMine = (name: string) => {
    if (!me || !myName) return;
    const before = myName;
    const base = bill.doc;
    run(
      () => renameMe(bill.id, me, name),
      { ...base, people: base.people.map((p) => (p.id === me ? { ...p, name } : p)) },
      () => {
        setAsking(false);
        if (name !== before)
          toast({
            message: fmt(t.page.nameSaved, { name }),
            action: { label: t.common.undo, onClick: () => renameMine(before) },
          });
      },
      name,
    );
  };

  const cantRemove = (id: string) => {
    const name = nameOf(id);
    if (bill.doc.items.some((i) => i.paidBy === id)) return fmt(t.person.paidABill, { name });
    if (bill.payments.some((p) => p.from === id || p.to === id)) return fmt(t.person.hasPayment, { name });
    const only = bill.doc.items.find((i) => i.participants.length === 1 && i.participants[0] === id);
    return only ? fmt(t.page.nobodyLeft, { name: only.name }) : null;
  };

  const savePeople = ({ title, names, removed, added }: PeopleChange) => {
    if (!title || Object.values(names).some((name) => !name)) return toast({ message: t.page.namesEmpty });
    const seen = new Set<string>();
    for (const name of [...Object.values(names), ...added.map((p) => p.name)]) {
      if (seen.has(name.toLowerCase())) return toast({ message: fmt(t.home.duplicateName, { name }) });
      seen.add(name.toLowerCase());
    }
    for (const id of removed) {
      const reason = cantRemove(id);
      if (reason) return toast({ message: reason });
    }
    const base = bill.doc;
    const lost = base.items.find((i) => i.participants.every((p) => removed.includes(p)));
    if (lost) return toast({ message: fmt(t.page.nobodyLeft, { name: lost.name }) });
    const close = () => setView(null);
    ownerSave(
      (d) => {
        const kept = removed.reduce(withoutPerson, d);
        return {
          ...kept,
          title,
          people: [...kept.people.map((p) => ({ ...p, name: names[p.id] ?? p.name })), ...added],
        };
      },
      t.page.namesSaved,
      () =>
        ownerSave(
          (d) => ({
            ...d,
            title: base.title,
            items: base.items,
            people: base.people.map((p) => {
              if (d.people.some((q) => q.id === p.id)) return p;
              const back = { ...p };
              delete back.addedAt;
              return back;
            }),
          }),
          t.page.namesSaved,
        ),
      close,
    );
  };

  const saveDetails = (
    personId: string,
    details: { bank: string | null; accountNo: string | null; payQr: string | null },
  ) => {
    if (owner)
      return ownerSave(
        (d) => ({ ...d, people: d.people.map((p) => (p.id === personId ? { ...p, ...details } : p)) }),
        personId === me ? t.member.detailsSaved : fmt(t.page.detailsSavedFor, { name: nameOf(personId) }),
        undefined,
        () => setView(null),
      );
    start(async () => {
      const result = await setMyDetails(bill.id, personId, details, getMe(bill.id));
      if (!result.ok && result.error === "taken") setView(null);
      if (!result.ok) return void toast({ message: errorText(result.error) });
      setView(null);
      toast({ message: t.member.detailsSaved });
    });
  };

  const toggleLock = () =>
    start(async () => {
      setShown({ ...bill.doc, locked: !locked });
      const result = await setBillLock(bill.id, ownerToken, !locked);
      toast({ message: result.ok ? (locked ? t.track.unlockedNote : t.track.lockedNote) : t.common.generic });
    });

  const ownerLink = (token: string) => `${window.location.origin}/bill/${bill.id}#owner=${token}`;

  const makeOwnerLink = () =>
    start(async () => {
      const result = await newOwnerLink(bill.id, ownerToken);
      if (!result.ok) return void toast({ message: t.common.generic });
      const token = result.data.ownerToken;
      setOwnerToken(bill.id, token);
      toast({
        message: t.page.newOwnerDone,
        action: { label: t.common.copy, onClick: () => void copy(ownerLink(token), t.page.ownerLinkCopied) },
      });
    });

  const makeOwner = (ownerId: string, name: string, added?: Person) =>
    ownerSave(
      (d) => ({ ...d, ownerId, people: added ? [...d.people, added] : d.people }),
      fmt(t.page.youAre, { name }),
      undefined,
      () => setAsking(false),
    );

  const typeOwner = (name: string) => {
    const same = doc.people.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (same?.addedAt) return toast({ message: fmt(t.home.duplicateName, { name }) });
    if (same) return makeOwner(same.id, same.name);
    const id = newId(6);
    const color = bill.doc.people.reduce((max, p) => Math.max(max, p.color + 1), 0) % 100;
    makeOwner(id, name, { id, name, color });
  };

  const tellGroup = () => {
    setTell(false);
    void send(
      `${fmt(t.member.tellMessage, { who: myName ?? t.history.someone, title: doc.title })} ${window.location.origin}/bill/${bill.id}`,
    );
  };

  const hasAccount = (p: Person) => Boolean(p.bank && p.accountNo);
  const hasDetails = (p: Person) => Boolean(p.payQr) || hasAccount(p);

  const openBank = () => {
    setMenu(null);
    if (!me || !meRow) return;
    if (owner) return openView({ kind: "bank", personId: me, back: true });
    if (locked) return toast({ message: lockedText });
    if (mine.people.includes(me) || detailsOpenToName(doc, meRow))
      return openView({ kind: "bank", personId: me, back: true });
    if (hasDetails(meRow)) return showAsk({ kind: "details", personId: me });
    toast({ message: t.member.detailsTaken });
  };

  const addBill = (from?: Menu) => {
    setMenu(null);
    if (locked && !owner) return toast({ message: lockedText });
    withMe(() => openView({ kind: "add" }, from));
  };

  const showCalc = (from?: Menu) => openView({ kind: "how" }, from);

  const tiles: Tile[] = [
    { key: "add", icon: <PlusIcon size={21} />, label: t.home.nextBill, onClick: () => addBill("root") },
    {
      key: "history",
      icon: <ClockIcon />,
      label: t.history.title,
      dot: changes.count > 0,
      onClick: () => {
        changes.clear();
        if (desktop) openView({ kind: "history" });
        else setMenu("history");
      },
    },
  ];
  if (doc.items.length && !desktop)
    tiles.push({ key: "how", icon: <CalculatorIcon />, label: t.how.tile, onClick: () => showCalc("root") });

  const detailsLine = (p: Person) =>
    [p.bank, p.payQr ? t.person.qrAdded : null].filter(Boolean).join(" · ") || t.member.bankSub;

  const openPeople = () => openView({ kind: "people" });

  const meRows: Tile[] = [];
  if (meRow)
    meRows.push({
      key: "bank",
      icon: <BankIcon />,
      label: t.member.bankDetails,
      sub: detailsLine(meRow),
      onClick: () => openBank(),
    });
  if (owner && !meRow)
    meRows.push({
      key: "you",
      icon: <PlusIcon size={21} />,
      label: t.page.addYourName,
      onClick: () => showAsk({ kind: "owner", back: true }),
    });
  if (!owner && myName)
    meRows.push({
      key: "name",
      icon: <PencilIcon size={21} />,
      label: t.page.myName,
      onClick: () => (locked ? toast({ message: lockedText }) : showAsk({ kind: "myName", back: true })),
    });
  const [notMeAsk, notMeLink = ""] = t.member.notMe.split("? ");
  const ownerRows: Tile[] = [
    {
      key: "people",
      icon: <PencilIcon size={21} />,
      label: t.page.names,
      sub: `${doc.title} · ${doc.people.map((p) => p.name).join(", ")}`,
      onClick: openPeople,
    },
    {
      key: "lock",
      icon: <LockIcon />,
      label: t.page.openToAll,
      sub: t.page.lockSub,
      checked: !locked,
      onClick: toggleLock,
    },
  ];
  if (ownerToken)
    ownerRows.push({
      key: "link",
      icon: <LinkIcon size={21} />,
      label: t.page.copyOwnerLink,
      sub: t.page.copyOwnerSub,
      next: false,
      onClick: () => void copy(ownerLink(ownerToken), t.page.ownerLinkCopied),
    });
  ownerRows.push({
    key: "newLink",
    icon: <ResetIcon size={20} />,
    label: t.page.newOwnerLink,
    sub: t.page.newOwnerSub,
    next: false,
    onClick: makeOwnerLink,
  });

  const myItems = me ? doc.items.filter((i) => i.participants.includes(me)) : [];
  const myShare = me ? myItems.reduce((sum, i) => sum + (itemShares(i)[me] ?? 0), 0) : 0;
  const [shareBefore, shareAfter = ""] = t.page.yourShare.split("{amount}");

  const canTap = (line: PlanLine) => {
    if (owner) return true;
    if (!me) return false;
    if (line.paymentId) return mine.payments.includes(line.paymentId);
    return line.from === me || line.to === me;
  };

  const lineHint = () => {
    if (summary.remaining.length === 0) return undefined;
    if (owner) return t.page.ownerHint;
    if (myName) {
      if (summary.remaining.some((l) => l.from === me)) return t.member.tapHint;
      if (summary.remaining.some((l) => l.to === me)) return t.page.gotPaidHint;
      return undefined;
    }
    return canName ? t.member.chooseHint : undefined;
  };

  const markedBy = (line: PlanLine) => {
    const at = time(line.paidAt!);
    if (line.byRole === "owner")
      return owner ? fmt(t.track.youMarked, { time: at }) : fmt(t.track.tappedPaid, { name: ownerName, time: at });
    const by = bill.events.find((e) => e.kind === "paid" && e.paymentId === line.paymentId)?.byName;
    return by ? fmt(t.track.tappedPaid, { name: by, time: at }) : fmt(t.track.markedPaid, { time: at });
  };

  const body = (bare: boolean) => {
    if (!view) return null;
    const close = () => {
      setView(null);
      setBackTo(null);
    };
    switch (view.kind) {
      case "add":
        return (
          <BillForm
            item={null}
            doc={doc}
            first={false}
            bare={bare}
            autoFocus={desktop}
            title={owner ? undefined : t.member.addTitle}
            defaultPaidBy={me ?? undefined}
            onAdd={addItem}
            onPrinted={close}
            onCancel={close}
            onPreview={setPreview}
          />
        );
      case "edit": {
        const item = doc.items.find((i) => i.id === view.itemId);
        return item ? (
          <BillForm
            key={item.id}
            item={item}
            doc={doc}
            first={false}
            bare={bare}
            autoFocus={desktop}
            onAdd={(next, people) => saveItem(item, next, people)}
            onDelete={deleteItem}
            onPrinted={close}
            onCancel={close}
            onPreview={setPreview}
          />
        ) : null;
      }
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
        if (!person) return null;
        const form = (
          <BankForm
            person={person}
            own={person.id === me}
            bare={bare}
            pending={pending}
            onSave={(details) => saveDetails(person.id, details)}
            onCancel={close}
          />
        );
        return view.back ? <PanelBack.Provider value={backToMe}>{form}</PanelBack.Provider> : form;
      }
      case "people":
        return (
          <PanelBack.Provider value={backToMe}>
            <PeopleForm
              doc={doc}
              bare={bare}
              pending={pending}
              blocked={cantRemove}
              onSave={savePeople}
              onCancel={close}
            />
          </PanelBack.Provider>
        );
      case "history":
        return (
          <div className="flex flex-col gap-2.5">
            <PanelHead title={t.history.title} onClose={close} />
            {bill.events.length === 0 ? (
              <p className="m-0 text-[14px] text-muted">{t.history.empty}</p>
            ) : (
              <HistoryList doc={doc} events={bill.events} />
            )}
          </div>
        );
      case "how":
        return (
          <div className="flex flex-col gap-2.5">
            <PanelHead title={t.how.title} onClose={close} />
            <Workings doc={doc} payments={bill.payments} onDone={backTo ? goBack : close} />
          </div>
        );
    }
  };

  const addPreview = view?.kind === "add" || view?.kind === "edit" ? preview : null;
  const previewing = addPreview ?? payPreview;
  const quietPaper = Boolean(view || previewing);

  const payToWord = (p: Person): ReceiptWord | null => {
    if (quietPaper) return null;
    const label = hasDetails(p) ? t.member.bankDetails : t.member.addBankDetails;
    const edit = { label: `${label} ›`, name: `${label} ${p.name}`, tone: "go" as const };
    if (owner) return { ...edit, onClick: () => openView({ kind: "bank", personId: p.id }) };
    const onThisName = p.id === me && detailsOpenToName(doc, p);
    if (!locked && myName && (mine.people.includes(p.id) || onThisName))
      return { ...edit, onClick: () => openView({ kind: "bank", personId: p.id }) };
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
    const qr = person.payQr ? readQrDetails(person.payQr) : null;
    const sameBank = !qr?.bank || !person.bank || qr.bank.toLowerCase() === person.bank.toLowerCase();
    const account = qr && sameBank && hasAccount(person) ? (person.accountNo ?? null) : null;
    return (
      <>
        {qr && !nameFitsQr(person.name, qr.name) ? (
          <div className="rounded-xl bg-owe/10 px-3 py-2.5 text-[13px] leading-[1.35] text-owe">
            <b className="block font-extrabold">{fmt(t.person.qrNameOff, { qr: qr.name ?? "", name: person.name })}</b>
            {fmt(t.person.qrNameAsk, { name: person.name })}
          </div>
        ) : null}
        {person.payQr && qr ? (
          <PayQr
            code={person.payQr}
            fileName={qrFileName(person.name, qr.name)}
            card={{
              name: qr.name,
              bank: [qr.bank ?? person.bank, account].filter(Boolean).join(" · ") || null,
              kind: qr.duitNow ? "DuitNow QR" : null,
            }}
            account={account}
            onCopy={() => copy(account!.replace(/\s+/g, ""))}
          />
        ) : null}
        {hasAccount(person) && !account ? (
          <div className="flex items-center justify-between gap-3 border-y border-line py-2.5">
            <span className="min-w-0">
              <b className="block text-[14.5px]">{person.bank}</b>
              <span className="block text-[13px] text-muted tabular">{person.accountNo}</span>
            </span>
            <button
              type="button"
              onClick={() => copy(person.accountNo!.replace(/\s+/g, ""))}
              className="min-h-11 shrink-0 text-[14px] font-bold text-green-ink"
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
      case "me":
        return (
          <>
            {meRows.length ? <Rows tiles={meRows} /> : null}
            {owner ? (
              <>
                <span className="-mb-2 px-0.5 text-[12.5px] font-bold text-faint">{t.page.thisBill}</span>
                <Rows tiles={ownerRows} />
              </>
            ) : myName ? (
              <button
                type="button"
                onClick={() => showAsk({ kind: "who", then: () => undefined, hide: me, back: true })}
                className="h-11 shrink-0 text-[14px] font-semibold text-muted"
              >
                {fmt(notMeAsk, { name: myName })}? <span className="font-bold text-green-ink">{notMeLink}</span>
              </button>
            ) : null}
          </>
        );
      case "myName":
        return <NameBody name={myName ?? ""} pending={pending} onSave={renameMine} />;
      case "owner":
        return (
          <>
            <p className="m-0 text-[14px] text-muted">{t.share.whichDesc}</p>
            <PickOrType
              people={doc.people.filter((p) => !p.addedAt)}
              button={t.common.save}
              pending={pending}
              onPick={(id) => makeOwner(id, nameOf(id))}
              onName={typeOwner}
            />
            <button
              type="button"
              onClick={() => setAsking(false)}
              className="h-11 shrink-0 text-[15px] font-bold text-muted"
            >
              {t.page.notNow}
            </button>
          </>
        );
      case "confirm": {
        const { line } = ask;
        const payer = line.from === me;
        return (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-[30px] font-extrabold tracking-[-0.02em] tabular">{money(line.amount)}</div>
              <button
                type="button"
                onClick={() => {
                  setAsking(false);
                  openView({ kind: "pay", from: line.from, to: line.to });
                }}
                className="min-h-11 shrink-0 text-[14.5px] font-bold text-green-ink"
              >
                {t.bill.change} ›
              </button>
            </div>
            {payer ? payDetails(line.to) : null}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => pay({ from: line.from, to: line.to, amountMinor: line.amount }, false)}
                className="h-14 shrink-0 rounded-2xl bg-green text-[16px] font-bold text-white disabled:opacity-60"
              >
                {t.track.markPaid}
              </button>
              {payer ? null : (
                <button
                  type="button"
                  onClick={() => remind(line)}
                  className="h-12 shrink-0 rounded-2xl bg-chip text-[15px] font-bold text-ink"
                >
                  {fmt(t.track.remind, { name: nameOf(line.from) })}
                </button>
              )}
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
            <p className="m-0 text-[14px] text-muted">
              {line.paidAt ? (
                <>
                  {markedBy(line)}
                  <br />
                </>
              ) : null}
              {t.member.undoDesc}
            </p>
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

  const meTitle = (
    <span className="flex min-w-0 items-center gap-2.5 text-[17px] font-extrabold tracking-[-0.01em]">
      {meRow ? (
        <>
          <Avatar name={meRow.name} color={meRow.color} size={34} />
          <span className="min-w-0 truncate">{meRow.name}</span>
        </>
      ) : null}
      {owner ? <OwnerChip /> : null}
    </span>
  );

  const askTitle =
    ask?.kind === "who"
      ? t.member.whoTitle
      : ask?.kind === "me"
        ? meTitle
        : ask?.kind === "myName"
          ? t.page.nameTitle
          : ask?.kind === "owner"
            ? t.share.whichTitle
            : ask?.kind === "undo"
              ? ask.line.from === me
                ? fmt(t.member.undoTitle, { to: nameOf(ask.line.to) })
                : fmt(t.page.paidTitle, { from: nameOf(ask.line.from), to: nameOf(ask.line.to) })
              : ask?.kind === "details"
                ? fmt(t.member.detailsOf, { name: nameOf(ask.personId) })
                : ask
                  ? fmt(t.member.confirmTitle, { from: nameOf(ask.line.from), to: nameOf(ask.line.to) })
                  : "";
  const askInPanel = desktop && asking && ask !== null && (ask.kind !== "who" || Boolean(ask.back));

  const openMe = () => showAsk({ kind: "me" });
  const backToMe = () => {
    setView(null);
    setBackTo(null);
    openMe();
  };
  const askBack = ask && "back" in ask && ask.back ? openMe : undefined;
  const topLine = owner ? (
    <div className="flex min-h-9 min-w-0 items-center gap-2">
      {ownerPerson ? (
        <>
          <Greeting name={ownerPerson.name} onChange={openMe} className="min-w-0" />
          <OwnerChip />
        </>
      ) : (
        <button type="button" aria-haspopup="dialog" onClick={openMe} className="flex h-9 items-center gap-1">
          <OwnerChip />
          <ChevronDownIcon className="shrink-0 text-muted" />
        </button>
      )}
    </div>
  ) : myName ? (
    <Greeting name={myName} onChange={openMe} />
  ) : canName ? (
    <Greeting text={t.member.whoTitle} onChange={() => showAsk({ kind: "who", then: () => undefined })} />
  ) : null;

  const paidSum = summary.done.reduce((sum, l) => sum + l.amount, 0);
  const allSum = paidSum + summary.remaining.reduce((sum, l) => sum + l.amount, 0);
  const lineCount = summary.done.length + summary.remaining.length;
  const progress =
    lineCount > 0 ? (
      <div className={desktop ? undefined : "px-1.5"}>
        <div className="mb-[7px] flex items-baseline justify-between gap-2.5 text-[14px] md:text-[15px]">
          {summary.remaining.length === 0 ? (
            <b className="font-extrabold text-green-ink">{t.page.everyonePaid}</b>
          ) : (
            <b className="font-extrabold">{fmt(t.track.progress, { done: summary.done.length, total: lineCount })}</b>
          )}
          <span className="text-muted tabular">
            {money(paidSum)} {t.track.of} {money(allSum)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-[3px] bg-track">
          <i
            className="block h-full rounded-[3px] bg-green transition-[width] duration-300"
            style={{ width: `${allSum ? Math.round((paidSum / allSum) * 100) : 0}%` }}
          />
        </div>
      </div>
    ) : null;

  const lockNote = locked ? (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] leading-[1.35] font-semibold text-muted",
        desktop ? "bg-chip" : "bg-card",
      )}
    >
      <LockIcon size={16} className="shrink-0 text-ink" />
      <span>{owner ? t.track.lockedNote : lockedText}</span>
    </div>
  ) : null;

  const tellCard =
    tell && !locked ? (
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

  const detail = (item: Item, onBack?: () => void, onClose?: () => void) => (
    <BillDetail
      key={`${item.id}:${me ? itemShares(item)[me] : ""}`}
      item={item}
      doc={doc}
      me={me}
      rules={rules}
      pending={pending}
      onBack={onBack}
      onClose={onClose}
      note={
        locked && !owner ? fmt(t.page.lockedBills, { name: ownerName }) : fmt(t.page.cantLeave, { name: ownerName })
      }
      onPart={setPart}
      onEdit={(i) => openView({ kind: "edit", itemId: i.id }, menu ?? undefined)}
      onLeave={(i) => {
        backToBills();
        toggleBill(i);
      }}
    />
  );

  const billsSub = locked && !owner ? fmt(t.page.lockedBills, { name: ownerName }) : undefined;

  const inMenu = Boolean(view && backTo);
  const closeMenu = () => {
    setMenu(null);
    setView(null);
    setBackTo(null);
  };
  const goBack = () => {
    setView(null);
    setMenu(backTo);
    setBackTo(null);
  };

  const openRow = (id: string | null, show: (id: string | null) => void, from?: Menu) => {
    const item = id ? doc.items.find((i) => i.id === id) : undefined;
    if (item && rules.canEdit(item)) return openView({ kind: "edit", itemId: item.id }, from);
    show(id);
  };

  const menuPage = () => {
    const head = (title: string, sub?: string) => (
      <PanelBack.Provider value={() => setMenu("root")}>
        <PanelHead title={title} sub={sub} onClose={closeMenu} />
      </PanelBack.Provider>
    );
    if (menu === "bills")
      return (
        <>
          {head(t.page.yourBills, billsSub ?? (me ? fmt(t.page.yourShare, { amount: money(myShare) }) : undefined))}
          <BillRows
            doc={doc}
            me={me}
            open={null}
            rules={rules}
            onOpen={(id) => openRow(id, (next) => (next ? setMenu(`bill:${next}`) : undefined), "bills")}
            onToggle={toggleBill}
          />
          <div className="mt-1 border-t border-line pt-1">
            <MenuItem icon={<PlusIcon size={18} />} label={t.home.nextBill} onClick={() => addBill("bills")} />
          </div>
        </>
      );
    if (menu === "history")
      return (
        <>
          {head(t.history.title)}
          {bill.events.length === 0 ? (
            <p className="m-0 py-2 text-[14px] text-muted">{t.history.empty}</p>
          ) : (
            <HistoryList doc={doc} events={bill.events} />
          )}
        </>
      );
    if (menu?.startsWith("bill:")) {
      const item = doc.items.find((i) => i.id === menu.slice(5));
      return item ? detail(item, () => setMenu("bills"), closeMenu) : null;
    }
    return null;
  };

  const menuTiles: Tile[] =
    me || owner
      ? [
          {
            key: "bills",
            icon: <ReceiptIcon />,
            label: t.page.yourBills,
            onClick: () => setMenu("bills"),
          },
          ...tiles,
        ]
      : tiles;

  const sharedBy = ownerPerson?.name ?? "";
  const created = date(bill.createdAt, { day: "numeric", month: "short" });

  const billsSection = (
    <section key="bills" className="relative z-[2]">
      <div className="mb-1 flex items-baseline justify-between gap-2.5 text-[13px] font-semibold text-muted">
        <span>{named ? t.page.yourBills : t.page.pickName}</span>
        <span className="flex items-baseline gap-1.5">
          {me ? (
            <span>
              {shareBefore}
              <b className="font-extrabold text-ink tabular">{money(myShare)}</b>
              {shareAfter}
            </span>
          ) : null}
          {me && doc.items.length ? <span aria-hidden>·</span> : null}
          {doc.items.length ? (
            <button type="button" onClick={() => showCalc()} className="font-bold text-green-ink">
              {t.how.title} ›
            </button>
          ) : null}
        </span>
      </div>
      {billsSub ? <p className="m-0 mb-1 text-[12.5px] text-muted">{billsSub}</p> : null}
      {named ? (
        <BillRows
          doc={doc}
          me={me}
          open={openBill}
          rules={rules}
          onOpen={(id) => openRow(id, setOpenBill)}
          onToggle={toggleBill}
          onHover={setHover}
          detail={(item) => detail(item)}
        />
      ) : null}
    </section>
  );

  const side = view ? (
    body(true)
  ) : askInPanel ? (
    <div className="flex flex-col gap-2.5">
      <PanelBack.Provider value={askBack ?? null}>
        <PanelHead title={askTitle} onClose={() => setAsking(false)} />
      </PanelBack.Provider>
      {askBody()}
    </div>
  ) : (
    <div className="flex w-full max-w-[460px] flex-col gap-5">
      <div className="flex flex-col">
        {topLine}
        <span className="mt-3 text-[11px] font-bold tracking-[0.06em] text-faint uppercase">
          {sharedBy ? fmt(t.member.sharedLine, { name: sharedBy, date: created }) : created}
        </span>
        <h1 className="m-0 mt-1.5 text-[30px] leading-[1.15] font-extrabold tracking-[-0.025em]">{doc.title}</h1>
      </div>
      {progress}
      {lockNote}
      {tellCard}
      <Rise className="flex flex-col gap-[22px]">
        {[
          <ShareCard key="share" big onClick={() => share.show()} />,
          <div key="tiles" className="flex flex-wrap justify-center gap-x-2 gap-y-3 [&>*]:w-[76px]">
            {tiles.map((tile) => (
              <IconTile key={tile.key} tile={tile} ring="var(--bg)" />
            ))}
          </div>,
          billsSection,
        ]}
      </Rise>
    </div>
  );

  return (
    <>
      <PrinterPage
        side={side}
        phoneTop={
          view ? undefined : (
            <>
              {topLine ? <div className="px-1">{topLine}</div> : null}
              {progress}
              {lockNote}
              {tellCard}
            </>
          )
        }
        panel={
          view ? (
            inMenu ? (
              <PanelBack.Provider value={goBack}>{body(true)}</PanelBack.Provider>
            ) : (
              body(true)
            )
          ) : menu && menu !== "root" ? (
            menuPage()
          ) : undefined
        }
        onPanelClose={closeMenu}
        dim={!view || !["add", "edit", "pay"].includes(view.kind)}
        fab={
          desktop ? undefined : (
            <>
              {menu === "root" ? (
                <MenuPills
                  tiles={menuTiles}
                  onShare={() => {
                    setMenu(null);
                    share.show(() => setMenu("root"));
                  }}
                  onClose={closeMenu}
                />
              ) : null}
              <MenuFab
                open={menu === "root"}
                dot={changes.count > 0}
                onClick={() => (menu === "root" ? closeMenu() : setMenu("root"))}
              />
            </>
          )
        }
        follow={previewing ? JSON.stringify(previewing) : undefined}
        paper={
          <Receipt
            doc={doc}
            payments={payPreview ? [...bill.payments, previewPayment(payPreview)] : bill.payments}
            billId={bill.id}
            expiresAt={bill.expiresAt}
            sharedBy={sharedBy}
            preview={addPreview}
            freshItemId={freshId}
            highlight={desktop ? (hover ?? openBill) : null}
            hint={quietPaper ? undefined : lineHint()}
            onHint={!named ? () => showAsk({ kind: "who", then: () => undefined }) : undefined}
            onLine={named && !quietPaper ? tapLine : undefined}
            canTap={canTap}
            payToWord={payToWord}
          />
        }
      />
      <Sheet open={asking && !askInPanel} onOpenChange={setAsking} title={askTitle} onBack={askBack}>
        {askBody()}
      </Sheet>
      {share.sheet}
    </>
  );
}

function Rows({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="-mx-2.5 flex flex-col divide-y divide-line">
      {tiles.map((tile) => (
        <MenuRow key={tile.key} tile={tile} />
      ))}
    </div>
  );
}

function OwnerChip() {
  const { t } = useI18n();
  return (
    <span className="shrink-0 rounded-full bg-green-soft px-2 py-0.5 text-[11px] font-bold text-green-soft-ink">
      {t.page.owner}
    </span>
  );
}
