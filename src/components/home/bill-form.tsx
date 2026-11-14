"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { CameraIcon, CheckIcon, CloseIcon } from "@/components/icons";
import { PanelHead } from "@/components/shared/panel-form";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { fmt, intlLocale } from "@/i18n";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useI18n } from "@/i18n/client";
import {
  baseOf,
  splitItem,
  withCharges,
  type BillDoc,
  type Charges,
  type Item,
  type Person,
  type PreviewItem,
} from "@/lib/bill";
import { addCharges, parseMoney, parseRate, rateText, toAutoPointInput, toInputValue } from "@/lib/money";
import { lineSplit, SCAN_TYPES, type Scan, type ScanError, type ScanLine } from "@/lib/receipt-scan";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { cn, newId, parseNames } from "@/lib/utils";
import { PersonChips } from "./person-chips";

const autoPoint = (v: string) => toAutoPointInput(v, "MYR");
const parse = (v: string) => parseMoney(v, "MYR");

type Rate = { on: boolean; text: string };
const rateOf = (bp: number | undefined, fallback: string): Rate =>
  bp ? { on: true, text: rateText(bp) } : { on: false, text: fallback };

type Kept = { subtotalMinor: number; serviceBp?: number; taxBp?: number; totalMinor: number };
type Line = ScanLine & { who: string[] };
type Attached = { shop: string; includedTaxBp?: number; offMinor?: number; photo: string | null };

export function BillForm({
  item,
  doc,
  update,
  first,
  bare = false,
  autoFocus = false,
  title,
  defaultPaidBy,
  onAdd,
  onDelete,
  onPrinted,
  onCancel,
  onPreview,
}: {
  item: Item | null;
  doc: BillDoc;
  update?: (fn: (doc: BillDoc) => BillDoc) => void;
  first: boolean;
  bare?: boolean;
  autoFocus?: boolean;
  title?: string;
  defaultPaidBy?: string;
  onAdd?: (item: Item, newPeople: Person[]) => void;
  onDelete?: (item: Item) => void;
  onPrinted: (id: string) => void;
  onCancel?: () => void;
  onPreview: (item: PreviewItem | null) => void;
}) {
  const { t, money, plain, locale } = useI18n();
  const toast = useToast();
  const isEdit = Boolean(item);
  const [newPeople, setNewPeople] = useState<Person[]>([]);
  const people = [...doc.people, ...newPeople];
  const everyone = people.map((p) => p.id);

  const [name, setName] = useState(item?.name ?? "");
  const [amount, setAmount] = useState(item ? toInputValue(baseOf(item), "MYR") : "");
  const saved = item?.charges;
  const [showCharges, setShowCharges] = useState(Boolean(saved));
  const [service, setService] = useState(rateOf(saved?.serviceBp, "10"));
  const [tax, setTax] = useState(rateOf(saved?.taxBp, "6"));
  const [kept, setKept] = useState<Kept | null>(item && saved ? { ...saved, totalMinor: item.amountMinor } : null);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [scan, setScan] = useState<"idle" | "reading" | ScanError>("idle");
  const [receipt, setReceipt] = useState<Attached | null>(null);
  const [showPhoto, setShowPhoto] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [filled, setFilled] = useState(0);
  const photos = useRef<string[]>([]);
  const [paidBy, setPaidBy] = useState(
    item?.paidBy ?? (onAdd ? (defaultPaidBy ?? "") : (doc.ownerId ?? everyone[0] ?? "")),
  );
  const [participants, setParticipants] = useState<string[]>(item?.participants ?? everyone);
  const [overrides, setOverrides] = useState<Record<string, number>>(item?.overrides ?? {});
  const [editing, setEditing] = useState<{ id: string; value: string; start: string } | null>(null);
  const [showSplit, setShowSplit] = useState(false);
  const [paid, setPaid] = useState("");
  const [editPaid, setEditPaid] = useState(false);
  const [editName, setEditName] = useState(false);
  const [payerOpen, setPayerOpen] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  const jump = useRef(false);
  const openRow = useRef<HTMLLIElement>(null);
  const desktop = useIsDesktop();

  const amountMinor = parse(amount) ?? 0;
  const included = everyone.filter((id) => participants.includes(id));
  const liveOverrides = { ...overrides };
  if (editing && editing.value !== editing.start) {
    const v = parse(editing.value);
    if (v === null) delete liveOverrides[editing.id];
    else liveOverrides[editing.id] = v;
  }
  const split = splitItem(amountMinor, included, liveOverrides);
  const serviceBp = service.on ? parseRate(service.text) : undefined;
  const taxBp = tax.on ? parseRate(tax.text) : undefined;
  const ratesOk = serviceBp !== null && taxBp !== null;
  const added = addCharges(amountMinor, { serviceBp: serviceBp ?? undefined, taxBp: taxBp ?? undefined });
  const keepTotal =
    kept !== null &&
    amountMinor === kept.subtotalMinor &&
    (serviceBp ?? undefined) === kept.serviceBp &&
    (taxBp ?? undefined) === kept.taxBp;
  const scanned = receipt !== null && lines !== null;
  const paidMinor = parse(paid) ?? 0;
  const asPrinted = kept !== null && amountMinor === kept.subtotalMinor && paidMinor === kept.totalMinor;
  const totalMinor = scanned ? paidMinor : keepTotal ? kept.totalMinor : added.total;
  const offBy = keepTotal && !isEdit ? Math.abs(added.total - kept.totalMinor) : 0;
  const charges: Charges | undefined = scanned
    ? paidMinor > 0 && paidMinor !== amountMinor
      ? {
          subtotalMinor: amountMinor,
          ...(asPrinted && kept?.serviceBp ? { serviceBp: kept.serviceBp } : {}),
          ...(asPrinted && kept?.taxBp ? { taxBp: kept.taxBp } : {}),
        }
      : undefined
    : ratesOk && (totalMinor !== amountMinor || serviceBp || taxBp)
      ? {
          subtotalMinor: amountMinor,
          ...(serviceBp ? { serviceBp } : {}),
          ...(taxBp ? { taxBp } : {}),
        }
      : undefined;
  const finalShares = split.ok ? withCharges({ amountMinor: totalMinor, charges }, split.shares, liveOverrides) : {};
  const hasOverrides = Object.keys(liveOverrides).some((id) => included.includes(id));
  const custom = hasOverrides || included.length !== everyone.length;
  const expanded = showSplit || custom;
  const fixedSum = included.reduce((s, id) => s + (liveOverrides[id] ?? 0), 0);
  const cleanOverrides = Object.fromEntries(Object.entries(liveOverrides).filter(([id]) => included.includes(id)));

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "?";
  const list = (ids: string[]) =>
    new Intl.ListFormat(intlLocale(locale), { type: "conjunction" }).format(ids.map(nameOf));
  const freeIds = included.filter((id) => liveOverrides[id] === undefined);
  const setIds = included.filter((id) => liveOverrides[id] !== undefined);
  const freeShares = split.ok ? freeIds.map((id) => split.shares[id] ?? 0) : [];
  const restHint = (() => {
    if (!hasOverrides || freeIds.length === 0 || !split.ok) return null;
    const rest = money(Math.max(0, amountMinor - fixedSum));
    const same = freeShares.every((v) => v === freeShares[0]);
    const each = same
      ? money(freeShares[0])
      : `${t.bill.about} ${money(Math.round(freeShares.reduce((a, b) => a + b, 0) / freeShares.length))}`;
    if (included.length === everyone.length) return fmt(t.bill.restExcept, { names: list(setIds), rest, each });
    return fmt(freeIds.length === 1 ? t.bill.restOne : t.bill.restNames, { names: list(freeIds), rest, each });
  })();

  const problem = !name.trim() ? null : amountMinor <= 0 ? null : !split.ok ? split.error : null;
  const canSave =
    Boolean(name.trim()) && amountMinor > 0 && totalMinor > 0 && split.ok && Boolean(paidBy) && (scanned || ratesOk);

  const previewKey = JSON.stringify([
    name,
    amountMinor,
    totalMinor,
    charges,
    paidBy,
    included,
    cleanOverrides,
    split.ok,
    newPeople,
  ]);
  useEffect(() => {
    const typing = isEdit || name.trim() !== "" || amountMinor > 0;
    onPreview(
      typing
        ? {
            id: item?.id ?? "preview",
            name,
            amountMinor: totalMinor,
            paidBy,
            participants: included,
            overrides: split.ok ? cleanOverrides : {},
            ...(charges && split.ok ? { charges } : {}),
            newPeople,
          }
        : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, isEdit]);
  useEffect(() => () => onPreview(null), [onPreview]);
  useEffect(() => {
    if (scan !== "reading") return;
    const last = t.bill.scanSteps.length - 1;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, last)), 2600);
    return () => clearInterval(timer);
  }, [scan, t.bill.scanSteps.length]);
  useEffect(() => {
    const row = openRow.current;
    if (!jump.current || !row?.parentElement) return;
    jump.current = false;
    let box = row.parentElement.parentElement;
    while (box && !/auto|scroll/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    const page = box ?? document.documentElement;
    const target =
      page.scrollTop +
      row.getBoundingClientRect().top -
      (box?.getBoundingClientRect().top ?? 0) -
      (parseFloat(getComputedStyle(row).scrollMarginTop) || 0);
    const list = row.parentElement;
    const room = page.scrollHeight - (parseFloat(list.style.paddingBottom) || 0) - page.clientHeight;
    list.style.paddingBottom = `${Math.max(0, Math.ceil(target - room))}px`;
    page.scrollTo({ top: target, behavior: "smooth" });
  }, [open]);
  useEffect(() => {
    const made = photos.current;
    return () => made.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const commitEditing = () => {
    if (!editing) return;
    if (editing.value === editing.start) {
      setEditing(null);
      return;
    }
    const v = parse(editing.value);
    setOverrides((o) => {
      const next = { ...o };
      if (v === null) delete next[editing.id];
      else next[editing.id] = v;
      return next;
    });
    setEditing(null);
  };

  const toggle = (id: string) => {
    setParticipants((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    setOverrides((o) => {
      const next = { ...o };
      delete next[id];
      return next;
    });
  };

  const addNames = (text: string, to?: number) => {
    const taken = new Set(people.map((p) => p.name.toLowerCase()));
    let color = people.reduce((max, p) => Math.max(max, p.color + 1), 0);
    const added: Person[] = [];
    for (const person of parseNames(text)) {
      if (taken.has(person.toLowerCase())) {
        toast({ message: fmt(t.home.duplicateName, { name: person }) });
        continue;
      }
      taken.add(person.toLowerCase());
      added.push({ id: newId(6), name: person, color: color++ % 100 });
    }
    setNewPeople((p) => [...p, ...added]);
    const ids = added.map((a) => a.id);
    if (!lines) setParticipants((p) => [...p, ...ids]);
    else
      applyLines(
        lines.map((l, j) => (j === to ? { ...l, who: [...l.who, ...ids] } : l)),
        [...everyone, ...ids],
      );
    return ids;
  };

  const fill = (result: Scan, photo: string | null) => {
    if (result.shop) setName(result.shop);
    const linesMinor = result.lines.reduce((sum, line) => sum + line.amountMinor, 0);
    setAmount(toInputValue(linesMinor > 0 ? linesMinor : result.subtotalMinor, "MYR"));
    setShowCharges(Boolean(result.serviceBp || result.taxBp || result.totalMinor !== result.subtotalMinor));
    setService(rateOf(result.serviceBp, "10"));
    setTax(rateOf(result.taxBp, "6"));
    setKept({
      subtotalMinor: result.subtotalMinor,
      serviceBp: result.serviceBp,
      taxBp: result.taxBp,
      totalMinor: result.totalMinor,
    });
    setLines(linesMinor > 0 ? result.lines.map((line) => ({ ...line, who: [] })) : null);
    setReceipt({ shop: result.shop, includedTaxBp: result.includedTaxBp, offMinor: result.offMinor, photo });
    setPaid(toInputValue(result.totalMinor, "MYR"));
    setEditPaid(false);
    setEditName(false);
    setPayerOpen(false);
    setOpen(0);
    setFixing(null);
    setParticipants(everyone);
    setOverrides({});
    setEditing(null);
    setShowSplit(false);
  };

  const scanPhoto = async (file: File) => {
    setScan("reading");
    setStep(0);
    setReading(null);
    const photo = await shrinkPhoto(file);
    if (!SCAN_TYPES.includes(photo.type)) return setScan("photo");
    const url = URL.createObjectURL(photo);
    photos.current.push(url);
    setReading(url);
    const body = new FormData();
    body.append("photo", photo, "receipt");
    const response = await fetch("/api/scan", { method: "POST", body }).catch(() => null);
    if (!response) return setScan("offline");
    const reply: { ok: true; data: Scan } | { ok: false; error: ScanError } | null = await response
      .json()
      .catch(() => null);
    if (!reply?.ok) return setScan(reply && reply.error in t.bill.scanErrors ? reply.error : "failed");
    fill(reply.data, url);
    setFilled((n) => n + 1);
    setScan("idle");
  };

  const removeReceipt = () => {
    const before = { name, amount, showCharges, service, tax, kept, lines, receipt, participants, overrides, paid };
    if (receipt?.shop && name === receipt.shop) setName("");
    setAmount("");
    setShowCharges(false);
    setService(rateOf(undefined, "10"));
    setTax(rateOf(undefined, "6"));
    setKept(null);
    setLines(null);
    setReceipt(null);
    setEditName(false);
    setEditPaid(false);
    setPayerOpen(false);
    setParticipants(everyone);
    setOverrides({});
    setEditing(null);
    toast({
      message: t.bill.receiptRemoved,
      action: {
        label: t.common.undo,
        onClick: () => {
          setName(before.name);
          setAmount(before.amount);
          setShowCharges(before.showCharges);
          setService(before.service);
          setTax(before.tax);
          setKept(before.kept);
          setLines(before.lines);
          setReceipt(before.receipt);
          setParticipants(before.participants);
          setOverrides(before.overrides);
          setPaid(before.paid);
        },
      },
    });
  };

  const applyLines = (next: Line[], all = everyone) => {
    setLines(next);
    setAmount(
      toInputValue(
        next.reduce((sum, line) => sum + line.amountMinor, 0),
        "MYR",
      ),
    );
    const fromLines = lineSplit(next, all, all);
    setParticipants(fromLines.participants);
    setOverrides(fromLines.overrides);
    setEditing(null);
  };

  const openItem = (i: number | null) => {
    jump.current = i !== null;
    setOpen(i);
    setFixing(null);
  };

  const setWho = (i: number, id: string | null) => {
    if (!lines) return;
    applyLines(
      lines.map((l, j) =>
        j !== i
          ? l
          : {
              ...l,
              who:
                id === null
                  ? []
                  : l.who.includes(id)
                    ? l.who.filter((x) => x !== id)
                    : everyone.filter((x) => x === id || l.who.includes(x)),
            },
      ),
    );
  };

  const commitFix = (i: number) => {
    const v = fixing === null ? null : parse(fixing);
    if (lines && v !== null && v > 0) applyLines(lines.map((l, j) => (j === i ? { ...l, amountMinor: v } : l)));
    setFixing(null);
  };

  const commitPaid = () => {
    if (paidMinor <= 0 && kept) setPaid(toInputValue(kept.totalMinor, "MYR"));
    setEditPaid(false);
  };

  const save = () => {
    if (!canSave) return;
    const joins = Object.fromEntries(Object.entries(item?.joins ?? {}).filter(([id]) => included.includes(id)));
    const next: Item = {
      id: item?.id ?? newId(6),
      name: name.trim().slice(0, 60),
      amountMinor: totalMinor,
      paidBy,
      participants: included,
      overrides: cleanOverrides,
      ...(charges ? { charges } : {}),
      ...(Object.keys(joins).length > 0 ? { joins } : {}),
    };
    if (onAdd) onAdd(next, newPeople);
    else
      update?.((d) => ({
        ...d,
        people: [...d.people, ...newPeople],
        items: isEdit ? d.items.map((i) => (i.id === next.id ? next : i)) : [...d.items, next],
      }));
    onPreview(null);
    onPrinted(next.id);
    if (!isEdit) {
      setName("");
      setAmount("");
      setOverrides({});
      setParticipants(doc.people.map((p) => p.id));
      setNewPeople([]);
      setShowSplit(false);
      setShowCharges(false);
      setService(rateOf(undefined, "10"));
      setTax(rateOf(undefined, "6"));
      setKept(null);
      setLines(null);
      setReceipt(null);
      setPaid("");
      setOpen(null);
      setFixing(null);
      setEditName(false);
      setEditPaid(false);
      setScan("idle");
    }
  };

  const remove = () => {
    if (!item) return;
    if (onDelete) {
      onDelete(item);
      onPreview(null);
      onCancel?.();
      return;
    }
    const index = doc.items.findIndex((i) => i.id === item.id);
    update?.((d) => ({ ...d, items: d.items.filter((i) => i.id !== item.id) }));
    onCancel?.();
    toast({
      message: fmt(t.bill.deleted, { name: item.name }),
      action: {
        label: t.common.undo,
        onClick: () =>
          update?.((d) => {
            if (d.items.some((i) => i.id === item.id)) return d;
            const items = [...d.items];
            items.splice(Math.min(index, items.length), 0, item);
            return { ...d, items };
          }),
      },
    });
  };

  const shares = Object.values(finalShares);
  const evenEach = shares.length > 0 ? Math.round(totalMinor / shares.length) : 0;
  const exact = shares.length > 0 && shares.every((v) => v === shares[0]);
  const problemText =
    problem === "over"
      ? fmt(t.bill.over, { amount: money(split.ok ? 0 : split.diff) })
      : problem === "under"
        ? fmt(t.bill.under, { amount: money(split.ok ? 0 : split.diff) })
        : problem
          ? t.bill.empty
          : null;
  const equalLine =
    amountMinor > 0 && shares.length > 0
      ? fmt(exact ? t.bill.splitEachLine : t.bill.splitAboutLine, { amount: money(evenEach) })
      : t.bill.splitEveryone;

  const payer = people.find((p) => p.id === paidBy);
  const scannedLine = [
    lines?.length === 1 ? t.bill.scannedOne : fmt(t.bill.scannedItems, { count: lines?.length ?? 0 }),
    receipt?.offMinor ? fmt(t.bill.discountOff, { amount: money(receipt.offMinor) }) : "",
    receipt?.includedTaxBp ? fmt(t.bill.taxIncluded, { rate: rateText(receipt.includedTaxBp) }) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const phone = bare && !desktop;
  const pill =
    "inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full bg-chip px-3 text-[13.5px] font-bold text-ink";
  const chip = "inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-full pr-3.5 pl-[5px] text-[14px] font-bold";
  const arrow =
    "grid h-[44px] w-[52px] shrink-0 place-items-center rounded-xl bg-chip text-[24px] leading-none font-bold text-ink disabled:opacity-35";
  const field =
    "h-[44px] w-full min-w-0 rounded-xl border border-border bg-card px-3.5 text-[16px] text-ink outline-none placeholder:font-normal focus:border-[1.5px] focus:border-green focus:shadow-[0_0_0_3px_var(--green-soft)]";

  const thumb = receipt ? (
    <button
      type="button"
      onClick={() => setShowPhoto(true)}
      disabled={!receipt.photo}
      aria-label={t.bill.seePhoto}
      className="h-[50px] w-[38px] shrink-0 -rotate-6 overflow-hidden rounded-[3px] bg-white shadow-[0_2px_5px_rgba(0,0,0,0.22)] transition-transform hover:rotate-0"
    >
      {receipt.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={receipt.photo} alt="" className="size-full object-cover" />
      ) : null}
    </button>
  ) : null;
  const unattach = (
    <button
      type="button"
      onClick={removeReceipt}
      aria-label={t.bill.removeReceipt}
      className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-card"
    >
      <CloseIcon size={14} strokeWidth={2.6} />
    </button>
  );

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className={cn("flex flex-col", bare ? "gap-2.5" : "gap-3 rounded-2xl border border-border bg-card p-4")}
      >
        <PanelHead
          title={title ?? (isEdit ? t.bill.editTitle : first ? t.bill.firstTitle : t.bill.addTitle)}
          onClose={onCancel}
        />

        {scanned && receipt && lines ? (
          <>
            <div className="flex animate-settle items-center gap-3 rounded-xl bg-chip py-2 pr-1 pl-3">
              {thumb}
              <div className="min-w-0 flex-1 leading-snug">
                {editName || !name.trim() ? (
                  <input
                    type="text"
                    value={name}
                    autoFocus={editName}
                    aria-label={t.bill.whatFor}
                    placeholder={t.bill.namePlaceholder}
                    maxLength={60}
                    enterKeyHint="done"
                    onFocus={() => setEditName(true)}
                    onBlur={() => setEditName(false)}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    className="h-9 w-full min-w-0 rounded-lg border-[1.5px] border-green bg-card px-2.5 text-[16px] font-bold text-ink outline-none placeholder:font-normal"
                  />
                ) : (
                  <button
                    type="button"
                    aria-label={`${t.bill.whatFor}: ${name}`}
                    onClick={() => setEditName(true)}
                    className="block max-w-full text-left text-[16px] leading-tight font-extrabold [overflow-wrap:anywhere]"
                  >
                    {name}{" "}
                    <span aria-hidden className="text-[13px] font-semibold text-muted">
                      ✎
                    </span>
                  </button>
                )}
                <span className="mt-0.5 block text-[12.5px] text-muted">{scannedLine}</span>
              </div>
              {unattach}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="relative"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setPayerOpen(false);
                }}
              >
                <button
                  type="button"
                  aria-expanded={payerOpen}
                  onClick={() => setPayerOpen(!payerOpen)}
                  className={cn(pill, payer && "pl-1.5")}
                >
                  {payer ? <Avatar name={payer.name} color={payer.color} size={24} /> : null}
                  {payer ? fmt(t.bill.paidBy, { name: payer.name }) : t.bill.whoPaid}
                  <span aria-hidden className="text-muted">
                    ⌄
                  </span>
                </button>
                {payerOpen ? (
                  <>
                    <button
                      type="button"
                      aria-hidden
                      tabIndex={-1}
                      onClick={() => setPayerOpen(false)}
                      className="fixed inset-0 z-20 cursor-default"
                    />
                    <div
                      role="group"
                      aria-label={t.bill.whoPaid}
                      className="absolute top-10 left-0 z-30 flex max-h-[260px] w-[230px] animate-drop flex-col overflow-y-auto rounded-2xl bg-card px-3 py-1 shadow-[0_12px_30px_rgba(0,0,0,0.28)] ring-1 ring-border"
                    >
                      {people.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          aria-pressed={p.id === paidBy}
                          onClick={() => {
                            setPaidBy(p.id);
                            setPayerOpen(false);
                          }}
                          className="flex min-h-[46px] shrink-0 items-center gap-2.5 border-b border-line text-left"
                        >
                          <Avatar name={p.name} color={p.color} size={26} />
                          <span className="min-w-0 flex-1 text-[14px] font-bold [overflow-wrap:anywhere]">
                            {p.name}
                          </span>
                          {p.id === paidBy ? (
                            <span className="text-green-ink">
                              <CheckIcon size={15} />
                            </span>
                          ) : null}
                        </button>
                      ))}
                      <div className="py-2">
                        <NewNameChip
                          onAdd={(text) => {
                            const [id] = addNames(text);
                            if (id) setPaidBy(id);
                            setPayerOpen(false);
                          }}
                        />
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              {editPaid ? (
                <span className="inline-flex h-[34px] items-center gap-1 rounded-full border-[1.5px] border-green bg-card pr-1 pl-3 text-[13.5px] font-bold shadow-[0_0_0_3px_var(--green-soft)]">
                  RM
                  <input
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    value={paid}
                    aria-label={t.bill.totalPaid}
                    onChange={(e) => setPaid(autoPoint(e.target.value))}
                    onBlur={commitPaid}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitPaid();
                      }
                    }}
                    className="w-[84px] bg-transparent text-[16px] font-extrabold text-ink tabular outline-none"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={commitPaid}
                    className="h-[26px] rounded-full bg-green px-2.5 text-[12.5px] font-bold text-white"
                  >
                    {t.bill.done}
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setEditPaid(true)} className={pill}>
                  {t.bill.totalPaid} <span className="tabular">{money(paidMinor)}</span>
                  <span aria-hidden className="text-muted">
                    ✎
                  </span>
                </button>
              )}
            </div>
            {kept && paidMinor > 0 && paidMinor < kept.totalMinor ? (
              <span className="animate-pop self-start rounded-full bg-green-soft px-2.5 py-1 text-[12.5px] font-bold text-green-ink">
                {fmt(t.bill.paidLess, {
                  amount: money(kept.totalMinor - paidMinor),
                  percent: Math.max(1, Math.round((1 - paidMinor / kept.totalMinor) * 100)),
                })}
              </span>
            ) : null}

            <div
              className={cn("mt-2 flex h-[26px] items-center gap-3", phone && "-mx-4 px-[18px]")}
              style={
                phone
                  ? {
                      background:
                        "radial-gradient(circle at 0 50%, var(--tray) 11px, transparent 11.5px), radial-gradient(circle at 100% 50%, var(--tray) 11px, transparent 11.5px)",
                    }
                  : undefined
              }
            >
              <i aria-hidden className="flex-1 border-t-2 border-dashed border-dash" />
              <h3 className="text-[13px] font-extrabold text-muted">{t.bill.whoHad}</h3>
              <i aria-hidden className="flex-1 border-t-2 border-dashed border-dash" />
            </div>

            <ol className="m-0 flex list-none flex-col p-0">
              {lines.map((line, i) => {
                const was = line.offMinor ? (
                  <>
                    <s className="font-semibold text-faint">{plain(line.amountMinor + line.offMinor)}</s>{" "}
                  </>
                ) : null;
                if (open !== i)
                  return (
                    <li key={i} className="border-b border-line last:border-b-0">
                      <button
                        type="button"
                        aria-expanded={false}
                        onClick={() => openItem(i)}
                        className="flex w-full items-center gap-3 px-0.5 py-3 text-left"
                      >
                        <span
                          aria-hidden
                          className="grid size-6 shrink-0 place-items-center rounded-full bg-chip text-[11.5px] font-extrabold text-muted"
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <b className="block text-[15px] leading-snug font-semibold [overflow-wrap:anywhere]">
                            {line.name}
                          </b>
                          <small className="mt-0.5 block truncate text-[12.5px] text-muted">
                            {line.who.length ? list(line.who) : t.bill.everyone}
                            {line.offMinor ? ` · ${fmt(t.bill.offShort, { amount: plain(line.offMinor) })}` : null}
                          </small>
                        </span>
                        <span className="text-right text-[14px] font-bold tabular">
                          {was}
                          {plain(line.amountMinor)}
                        </span>
                      </button>
                    </li>
                  );
                return (
                  <li
                    key={i}
                    ref={openRow}
                    className={cn(
                      "-mx-1.5 my-1 rounded-2xl bg-chip px-2.5 pb-3",
                      phone ? "scroll-mt-[68px]" : "scroll-mt-[140px]",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-expanded
                        onClick={() => openItem(null)}
                        className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-0.5 text-left"
                      >
                        <span
                          aria-hidden
                          className="grid size-6 shrink-0 place-items-center rounded-full bg-green text-[11.5px] font-extrabold text-white"
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <b className="block text-[15px] leading-snug font-bold [overflow-wrap:anywhere]">
                            {line.name}
                          </b>
                          {line.offMinor ? (
                            <small className="mt-0.5 block text-[12.5px] font-semibold text-green-ink">
                              {fmt(t.bill.itemOff, { amount: money(line.offMinor) })}
                            </small>
                          ) : null}
                        </span>
                      </button>
                      {fixing !== null ? (
                        <input
                          autoFocus
                          type="text"
                          inputMode="numeric"
                          value={fixing}
                          aria-label={fmt(t.bill.priceOf, { name: line.name })}
                          onChange={(e) => setFixing(autoPoint(e.target.value))}
                          onBlur={() => commitFix(i)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitFix(i);
                            }
                          }}
                          className="h-[34px] w-[88px] shrink-0 rounded-lg border-[1.5px] border-green bg-card px-2.5 text-right text-[16px] font-extrabold text-ink tabular shadow-[0_0_0_3px_var(--green-soft)] outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          aria-label={fmt(t.bill.priceOf, { name: line.name })}
                          onClick={() => setFixing(toInputValue(line.amountMinor, "MYR"))}
                          className="flex h-[34px] shrink-0 items-center gap-1 text-[14px] font-bold tabular"
                        >
                          {was}
                          {plain(line.amountMinor)}
                          <span aria-hidden className="text-[12px] text-muted">
                            ✎
                          </span>
                        </button>
                      )}
                    </div>
                    <div
                      role="group"
                      aria-label={fmt(t.bill.whoHadItem, { name: line.name })}
                      className="flex flex-wrap gap-1.5"
                    >
                      <button
                        type="button"
                        aria-pressed={line.who.length === 0}
                        onClick={() => setWho(i, null)}
                        className={cn(chip, "px-4", line.who.length === 0 ? "bg-green text-white" : "bg-card text-ink")}
                      >
                        {t.bill.everyone}
                      </button>
                      {people.map((p) => {
                        const had = line.who.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            aria-pressed={had}
                            onClick={() => setWho(i, p.id)}
                            className={cn(chip, had ? "bg-green text-white" : "bg-card text-ink")}
                          >
                            <Avatar name={p.name} color={p.color} size={28} />
                            {p.name}
                          </button>
                        );
                      })}
                      <NewNameChip tall onAdd={(text) => addNames(text, i)} />
                    </div>
                  </li>
                );
              })}
            </ol>

            <div
              className={cn(
                "flex gap-2",
                bare && "sticky bottom-0 z-10 pt-2",
                bare && (desktop ? "bg-bg pb-4" : "-mx-4 bg-card px-4"),
              )}
            >
              <button
                type="button"
                aria-label={t.bill.prevItem}
                disabled={!open}
                onClick={() => openItem((open ?? 1) - 1)}
                className={arrow}
              >
                ‹
              </button>
              <button
                type="submit"
                disabled={!canSave}
                onMouseDown={(e) => e.preventDefault()}
                className="h-[44px] min-w-0 flex-1 rounded-xl bg-green px-5 text-[15px] font-bold text-white disabled:bg-disabled disabled:text-disabled-ink"
              >
                {`${t.bill.printIt} ↵`}
              </button>
              <button
                type="button"
                aria-label={t.bill.nextItem}
                disabled={open !== null && open >= lines.length - 1}
                onClick={() => openItem(open === null ? 0 : open + 1)}
                className={arrow}
              >
                ›
              </button>
            </div>
          </>
        ) : (
          <>
            {isEdit ? null : receipt ? (
              <div className="flex animate-settle items-center gap-3 rounded-xl bg-chip py-2 pr-1 pl-3">
                {thumb}
                <div className="min-w-0 flex-1 leading-snug">
                  <b className="block text-[14px]">{t.bill.attached}</b>
                  <span className="block text-[12.5px] text-muted tabular">{money(totalMinor)}</span>
                  {receipt.offMinor ? (
                    <span className="block text-[12px] font-semibold text-green-ink">
                      {fmt(t.bill.discountOff, { amount: money(receipt.offMinor) })}
                    </span>
                  ) : null}
                  {receipt.includedTaxBp ? (
                    <span className="block text-[12px] font-semibold text-green-ink">
                      {fmt(t.bill.taxIncluded, { rate: rateText(receipt.includedTaxBp) })}
                    </span>
                  ) : null}
                </div>
                {unattach}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {scan === "reading" ? (
                  <div
                    role="status"
                    className="flex animate-settle items-center gap-3.5 overflow-hidden rounded-xl bg-chip px-3.5 py-3"
                  >
                    <div aria-hidden className="relative shrink-0 p-1.5">
                      <i className="absolute top-0 left-0 size-3 rounded-tl-[5px] border-t-[2.5px] border-l-[2.5px] border-green-ink" />
                      <i className="absolute top-0 right-0 size-3 rounded-tr-[5px] border-t-[2.5px] border-r-[2.5px] border-green-ink" />
                      <i className="absolute bottom-0 left-0 size-3 rounded-bl-[5px] border-b-[2.5px] border-l-[2.5px] border-green-ink" />
                      <i className="absolute right-0 bottom-0 size-3 rounded-br-[5px] border-r-[2.5px] border-b-[2.5px] border-green-ink" />
                      <div className="h-[78px] w-[58px] -rotate-6 overflow-hidden rounded-[3px] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
                        {reading ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={reading} alt="" className="size-full object-cover" />
                        ) : null}
                      </div>
                      <i className="absolute inset-x-0 top-1.5 h-0.5 animate-sweep rounded-full bg-[#34c26a] shadow-[0_0_10px_2px_#34c26a] before:absolute before:inset-x-0 before:bottom-0.5 before:h-6 before:bg-linear-to-t before:from-[#34c26a]/30 before:to-transparent before:content-['']" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <b className="block text-[14.5px] font-extrabold">{t.bill.scanning}</b>
                      <span className="block h-[18px] overflow-hidden text-[12.5px] text-muted">
                        <span key={step} className="block animate-rise">
                          {t.bill.scanSteps[step]}
                        </span>
                      </span>
                      <span className="relative mt-2 block h-[3px] overflow-hidden rounded-full bg-line">
                        <i className="absolute inset-y-0 left-0 w-2/5 animate-slide rounded-full bg-green" />
                      </span>
                    </div>
                  </div>
                ) : (
                  <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-dash text-[13.5px] font-bold text-green-ink focus-within:border-green">
                    <CameraIcon size={18} />
                    {t.bill.scan}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only text-[16px]"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void scanPhoto(file);
                      }}
                    />
                  </label>
                )}
                {scan in t.bill.scanErrors ? (
                  <p role="alert" className="text-[11.5px] leading-snug font-semibold text-owe">
                    {t.bill.scanErrors[scan as ScanError]}
                  </p>
                ) : null}
              </div>
            )}

            <div className="grid grid-cols-[1.3fr_1fr] gap-2">
              <input
                type="text"
                value={name}
                autoFocus={autoFocus}
                key={`name-${filled}`}
                aria-label={t.bill.whatFor}
                placeholder={t.bill.namePlaceholder}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                className={cn(field, "font-semibold", filled > 0 && "animate-flash")}
              />
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                key={`amount-${filled}`}
                aria-label={t.bill.amount}
                placeholder="0.00"
                onChange={(e) => setAmount(autoPoint(e.target.value))}
                className={cn(field, "font-extrabold tabular", filled > 0 && "animate-flash")}
              />
            </div>

            {showCharges ? (
              <div className="flex flex-col">
                <ChargeRow label={t.bill.service} rate={service} onChange={setService} added={plain(added.service)} />
                <ChargeRow label={t.bill.sst} rate={tax} onChange={setTax} added={plain(added.tax)} />
                <div className="flex h-9 items-center justify-between border-t border-line text-[14px] font-bold">
                  <span>{t.bill.total}</span>
                  <span className="tabular">{money(totalMinor)}</span>
                </div>
                {offBy > 10 && kept ? (
                  <div className="text-[12px] font-semibold text-owe">
                    {fmt(t.bill.addsUp, { total: money(kept.totalMinor), sum: money(added.total) })}
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCharges(true)}
                className="-mt-1 h-7 self-start text-[12.5px] font-bold text-green-ink"
              >
                {t.bill.addCharges}
              </button>
            )}

            <div className={cn("flex flex-col", bare ? "gap-1.5" : "gap-2")}>
              <span className="text-[12.5px] text-muted">{t.bill.whoPaid}</span>
              <PersonChips people={people} value={paidBy} onChange={setPaidBy} bare={bare}>
                <NewNameChip onAdd={addNames} />
              </PersonChips>
            </div>

            {expanded ? (
              <div className="flex flex-col">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12.5px] text-muted">{t.bill.split}</span>
                  {custom ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOverrides({});
                        setParticipants(everyone);
                        setEditing(null);
                      }}
                      className="h-7 text-[12.5px] font-bold text-green-ink"
                    >
                      {t.bill.resetEqual}
                    </button>
                  ) : (
                    <span className="text-[12px] text-faint">{t.bill.tapToChange}</span>
                  )}
                </div>
                {people.map((p) => {
                  const on = participants.includes(p.id);
                  const isSet = on && liveOverrides[p.id] !== undefined;
                  const share = split.ok ? split.shares[p.id] : undefined;
                  const isEditing = editing?.id === p.id;
                  return (
                    <div key={p.id} className="flex h-11 items-center gap-2.5">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={fmt(t.bill.include, { name: p.name })}
                        onClick={() => toggle(p.id)}
                        className={cn(
                          "inline-flex size-[22px] shrink-0 items-center justify-center rounded-md",
                          on ? "bg-green text-white" : "border-2 border-dash",
                        )}
                      >
                        {on ? <CheckIcon size={13} /> : null}
                      </button>
                      <span className={cn("min-w-0 flex-1 truncate text-[14px] font-semibold", !on && "text-muted")}>
                        {p.name}
                        {isSet ? (
                          <span className="ml-1.5 text-[11.5px] text-green-ink">{t.bill.youSetThis}</span>
                        ) : null}
                      </span>
                      {isEditing || isSet ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          autoFocus={isEditing}
                          aria-label={fmt(t.bill.amountOf, { name: p.name })}
                          value={isEditing ? editing.value : toInputValue(liveOverrides[p.id] ?? 0, "MYR")}
                          onFocus={() => {
                            if (!isEditing) {
                              const current = toInputValue(liveOverrides[p.id] ?? 0, "MYR");
                              setEditing({ id: p.id, value: current, start: current });
                            }
                          }}
                          onChange={(e) =>
                            setEditing({ id: p.id, value: autoPoint(e.target.value), start: editing?.start ?? "" })
                          }
                          onBlur={commitEditing}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitEditing();
                            }
                          }}
                          className="h-[34px] w-[92px] rounded-lg border-[1.5px] border-green bg-card px-2.5 text-right text-[16px] font-extrabold text-ink tabular shadow-[0_0_0_3px_var(--green-soft)] outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={!on || amountMinor <= 0}
                          onClick={() => {
                            const current = share !== undefined ? toInputValue(share, "MYR") : "";
                            setEditing({ id: p.id, value: current, start: current });
                          }}
                          className="h-[34px] w-[92px] rounded-lg border border-border bg-bg px-2.5 text-right text-[14px] font-bold text-muted tabular"
                        >
                          {on && share !== undefined ? plain(share) : "–"}
                        </button>
                      )}
                    </div>
                  );
                })}
                {problemText ? (
                  <div className="text-[12.5px] font-semibold text-owe">{problemText}</div>
                ) : restHint ? (
                  <div className="text-[12px] text-muted">{restHint}</div>
                ) : null}
                {charges ? <div className="pt-1 text-[12px] text-muted">{t.bill.beforeCharges}</div> : null}
              </div>
            ) : (
              <div className="text-[12.5px] text-muted">
                {equalLine} ·{" "}
                <button type="button" onClick={() => setShowSplit(true)} className="font-bold text-green-ink">
                  {t.bill.change}
                </button>
              </div>
            )}

            <div className={cn("flex items-center gap-3", isEdit ? "justify-between" : "justify-end")}>
              {isEdit ? (
                <button type="button" onClick={remove} className="h-10 text-[13.5px] font-bold text-owe">
                  {t.bill.delete}
                </button>
              ) : null}
              <button
                type="submit"
                disabled={!canSave}
                onMouseDown={(e) => e.preventDefault()}
                className={cn(
                  "h-[44px] rounded-xl bg-green px-5 text-[15px] font-bold text-white disabled:bg-disabled disabled:text-disabled-ink",
                  bare && !isEdit && "w-full",
                )}
              >
                {isEdit ? t.common.save : `${t.bill.printIt} ↵`}
              </button>
            </div>
          </>
        )}
      </form>
      {receipt?.photo ? (
        <Sheet open={showPhoto} onOpenChange={setShowPhoto} title={t.bill.photoTitle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={receipt.photo} alt={t.bill.photoTitle} className="w-full rounded-lg" />
        </Sheet>
      ) : null}
    </>
  );
}

function ChargeRow({
  label,
  rate,
  onChange,
  added,
}: {
  label: string;
  rate: Rate;
  onChange: (rate: Rate) => void;
  added: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex h-11 items-center gap-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={rate.on}
        aria-label={label}
        onClick={() => onChange({ ...rate, on: !rate.on })}
        className={cn(
          "inline-flex size-[22px] shrink-0 items-center justify-center rounded-md",
          rate.on ? "bg-green text-white" : "border-2 border-dash",
        )}
      >
        {rate.on ? <CheckIcon size={13} /> : null}
      </button>
      <span className={cn("min-w-0 flex-1 truncate text-[14px] font-semibold", !rate.on && "text-muted")}>{label}</span>
      <label className="flex h-[34px] w-[76px] shrink-0 items-center rounded-lg border border-border bg-card px-2.5 focus-within:border-[1.5px] focus-within:border-green">
        <input
          type="text"
          inputMode="decimal"
          maxLength={6}
          value={rate.text}
          aria-label={fmt(t.bill.rateOf, { name: label })}
          onChange={(e) => onChange({ on: true, text: e.target.value.replace(/[^\d.]/g, "") })}
          className="w-full min-w-0 bg-transparent text-right text-[16px] font-bold text-ink tabular outline-none"
        />
        <span className="pl-0.5 text-[14px] text-muted">%</span>
      </label>
      <span className="w-[64px] shrink-0 text-right text-[13px] font-semibold text-muted tabular">
        {rate.on ? `+${added}` : "–"}
      </span>
    </div>
  );
}

function NewNameChip({ onAdd, tall = false }: { onAdd: (text: string) => void; tall?: boolean }) {
  const { t } = useI18n();
  const [value, setValue] = useState<string | null>(null);
  const commit = () => {
    if (value?.trim()) onAdd(value);
    setValue(null);
  };
  if (value === null) {
    return (
      <button
        type="button"
        onClick={() => setValue("")}
        className={cn(
          "inline-flex shrink-0 items-center rounded-full border-[1.5px] border-dashed border-dash px-3 text-[13px] font-bold whitespace-nowrap text-green-ink",
          tall ? "h-[38px]" : "h-[34px]",
        )}
      >
        {t.home.addPerson}
      </button>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border-[1.5px] border-green bg-card pr-1 pl-3 shadow-[0_0_0_3px_var(--green-soft)]",
        tall ? "h-[38px]" : "h-[34px]",
      )}
    >
      <input
        autoFocus
        type="text"
        value={value}
        maxLength={30}
        aria-label={t.home.addPersonLabel}
        placeholder={t.home.personPlaceholder}
        enterKeyHint="done"
        autoCapitalize="words"
        autoComplete="off"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") setValue(null);
        }}
        className="w-24 bg-transparent text-[16px] font-semibold text-ink outline-none"
      />
      <button
        type="button"
        aria-label={t.common.add}
        onMouseDown={(e) => e.preventDefault()}
        onClick={commit}
        className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-full bg-green text-white"
      >
        <CheckIcon size={13} />
      </button>
    </span>
  );
}
