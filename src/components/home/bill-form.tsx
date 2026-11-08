"use client";

import { useEffect, useRef, useState } from "react";
import { CameraIcon, CheckIcon, CloseIcon } from "@/components/icons";
import { PanelHead } from "@/components/shared/panel-form";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { fmt, intlLocale } from "@/i18n";
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
type Attached = { shop: string; includedTaxBp?: number; photo: string | null };

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
  const totalMinor = keepTotal ? kept.totalMinor : added.total;
  const offBy = keepTotal && !isEdit ? Math.abs(added.total - kept.totalMinor) : 0;
  const charges: Charges | undefined =
    ratesOk && (totalMinor !== amountMinor || serviceBp || taxBp)
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
  const canSave = Boolean(name.trim()) && amountMinor > 0 && split.ok && Boolean(paidBy) && ratesOk;

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

  const addNames = (text: string) => {
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
    setParticipants((p) => [...p, ...added.map((a) => a.id)]);
  };

  const fill = (result: Scan, photo: string | null) => {
    if (result.shop) setName(result.shop);
    setAmount(toInputValue(result.subtotalMinor, "MYR"));
    setShowCharges(Boolean(result.serviceBp || result.taxBp || result.totalMinor !== result.subtotalMinor));
    setService(rateOf(result.serviceBp, "10"));
    setTax(rateOf(result.taxBp, "6"));
    setKept({
      subtotalMinor: result.subtotalMinor,
      serviceBp: result.serviceBp,
      taxBp: result.taxBp,
      totalMinor: result.totalMinor,
    });
    setLines(result.lines.length > 1 ? result.lines.map((line) => ({ ...line, who: [] })) : null);
    setReceipt({ shop: result.shop, includedTaxBp: result.includedTaxBp, photo });
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
    const before = { name, amount, showCharges, service, tax, kept, lines, receipt, participants, overrides };
    if (receipt?.shop && name === receipt.shop) setName("");
    setAmount("");
    setShowCharges(false);
    setService(rateOf(undefined, "10"));
    setTax(rateOf(undefined, "6"));
    setKept(null);
    setLines(null);
    setReceipt(null);
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
        },
      },
    });
  };

  const applyLines = (next: Line[]) => {
    setLines(next);
    setAmount(
      toInputValue(
        next.reduce((sum, line) => sum + line.amountMinor, 0),
        "MYR",
      ),
    );
    const fromLines = lineSplit(next, everyone);
    setParticipants(fromLines?.participants ?? everyone);
    setOverrides(fromLines?.overrides ?? {});
    setEditing(null);
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
  const anyoneTapped = lines?.some((line) => line.who.length > 0) ?? false;
  const equalLine =
    amountMinor > 0 && shares.length > 0
      ? fmt(exact ? t.bill.splitEachLine : t.bill.splitAboutLine, { amount: money(evenEach) })
      : t.bill.splitEveryone;

  const field =
    "h-[44px] w-full min-w-0 rounded-xl border border-border bg-card px-3.5 text-[16px] text-ink outline-none placeholder:font-normal focus:border-[1.5px] focus:border-green focus:shadow-[0_0_0_3px_var(--green-soft)]";

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

        {isEdit ? null : receipt ? (
          <div className="flex animate-settle items-center gap-3 rounded-xl bg-chip py-2 pr-1 pl-3">
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
            <div className="min-w-0 flex-1 leading-snug">
              <b className="block text-[14px]">{t.bill.attached}</b>
              <span className="block text-[12.5px] text-muted tabular">
                {lines
                  ? fmt(t.bill.attachedItems, { count: lines.length, amount: money(totalMinor) })
                  : money(totalMinor)}
              </span>
              {receipt.includedTaxBp ? (
                <span className="block text-[12px] font-semibold text-green-ink">
                  {fmt(t.bill.taxIncluded, { rate: rateText(receipt.includedTaxBp) })}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={removeReceipt}
              aria-label={t.bill.removeReceipt}
              className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-card"
            >
              <CloseIcon size={14} strokeWidth={2.6} />
            </button>
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
            <p
              role={scan in t.bill.scanErrors ? "alert" : undefined}
              className={cn(
                "text-[11.5px] leading-snug",
                scan in t.bill.scanErrors ? "font-semibold text-owe" : "text-faint",
              )}
            >
              {scan in t.bill.scanErrors ? t.bill.scanErrors[scan as ScanError] : t.bill.scanNote}
            </p>
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
            readOnly={Boolean(lines)}
            tabIndex={lines ? -1 : undefined}
            onChange={(e) => setAmount(autoPoint(e.target.value))}
            className={cn(
              field,
              "font-extrabold tabular",
              filled > 0 && "animate-flash",
              lines && "border-transparent bg-chip focus:border-transparent focus:shadow-none",
            )}
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

        {lines ? (
          <div className="flex flex-col">
            <span className="text-[12.5px] text-muted">{t.bill.whoHad}</span>
            <span className="pb-1 text-[12px] text-faint">{t.bill.whoHadHint}</span>
            {lines.map((line, i) => (
              <div
                key={i}
                role="group"
                aria-label={line.name}
                className="flex animate-rise flex-col gap-1.5 border-t border-line py-2"
                style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{line.name}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={fmt(t.bill.amountOf, { name: line.name })}
                    value={toInputValue(line.amountMinor, "MYR")}
                    onChange={(e) =>
                      applyLines(
                        lines.map((l, j) =>
                          j === i ? { ...l, amountMinor: parse(autoPoint(e.target.value)) ?? 0 } : l,
                        ),
                      )
                    }
                    className="h-[34px] w-[92px] rounded-lg border border-border bg-card px-2.5 text-right text-[16px] font-bold text-ink tabular outline-none focus:border-[1.5px] focus:border-green"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {people.map((p) => {
                    const had = line.who.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={had}
                        onClick={() =>
                          applyLines(
                            lines.map((l, j) =>
                              j === i ? { ...l, who: had ? l.who.filter((id) => id !== p.id) : [...l.who, p.id] } : l,
                            ),
                          )
                        }
                        className={cn(
                          "h-7 rounded-full px-2.5 text-[12.5px] font-bold",
                          had ? "bg-green text-white" : "border border-border bg-card text-muted",
                        )}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-0.5 border-t border-line pt-2.5">
              <span className="text-[12.5px] text-muted">{t.bill.eachPart}</span>
              {problemText ? (
                <div className="text-[12.5px] font-semibold text-owe">{problemText}</div>
              ) : anyoneTapped ? (
                <div className="flex flex-wrap gap-x-3.5 gap-y-0.5 text-[14px] font-semibold">
                  {included.map((id) => (
                    <span key={id} className="whitespace-nowrap">
                      {nameOf(id)} <b className="font-extrabold tabular">{plain(finalShares[id] ?? 0)}</b>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[14px] font-semibold">{equalLine}</div>
              )}
            </div>
          </div>
        ) : expanded ? (
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
                    {isSet ? <span className="ml-1.5 text-[11.5px] text-green-ink">{t.bill.youSetThis}</span> : null}
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

function NewNameChip({ onAdd }: { onAdd: (text: string) => void }) {
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
        className="inline-flex h-[34px] shrink-0 items-center rounded-full border-[1.5px] border-dashed border-dash px-3 text-[13px] font-bold whitespace-nowrap text-green-ink"
      >
        {t.home.addPerson}
      </button>
    );
  }
  return (
    <span className="inline-flex h-[34px] shrink-0 items-center rounded-full border-[1.5px] border-green bg-card pr-1 pl-3 shadow-[0_0_0_3px_var(--green-soft)]">
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
