"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { ArrowRightIcon, BackIcon, CheckIcon, HelpIcon, SendIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { splitItem } from "@/lib/bill";
import { cn } from "@/lib/utils";

const NAMES = ["Haziq", "Najmi", "Afiq", "Imanul"];

/** The round "?" in the header plus the step-by-step guide it opens. */
export function HelpButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const steps = t.help.steps;
  const count = steps.length;
  const last = step === count - 1;
  const nextRef = useRef<HTMLButtonElement>(null);

  const show = () => {
    setStep(0);
    setOpen(true);
  };

  // ← and → move between steps while the guide is open; the desktop pop-up starts on Next.
  useEffect(() => {
    if (!open) return;
    nextRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setStep((s) => Math.min(count - 1, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, count]);

  return (
    <>
      <button
        type="button"
        aria-label={t.help.button}
        title={t.help.button}
        onClick={show}
        className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-chip hover:text-ink"
      >
        <HelpIcon size={19} />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={t.help.title} wide>
        {/* phone: stacked · desktop: words and buttons left, the try-it panel right */}
        <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:grid-rows-[auto_1fr_auto] md:gap-x-7 md:gap-y-5">
          {/* tap a bar to jump straight to that step */}
          <div className="-my-[5px] flex gap-1.5 md:col-start-1 md:row-start-1" aria-hidden>
            {steps.map((s, i) => (
              <span key={s.title} data-step={i} onClick={() => setStep(i)} className="group flex h-4 flex-1 cursor-pointer items-center">
                <span className={cn("h-1.5 w-full rounded-full transition-colors group-hover:bg-green/70", i === step ? "bg-green" : i < step ? "bg-green/40" : "bg-chip")} />
              </span>
            ))}
          </div>
          {/* every step's words share one cell, so the sheet is as tall as the longest and never jumps */}
          <div className="grid md:col-start-1 md:row-start-2">
            {steps.map((s, i) => (
              <div key={s.title} aria-hidden={i !== step} className={cn("col-start-1 row-start-1", i === step ? "animate-rise" : "invisible")}>
                <div className="text-[18px] font-extrabold md:text-[22px] md:leading-[1.25] md:tracking-[-0.01em]">{s.title}</div>
                <p className="mt-1.5 mb-0 text-[14px] leading-[1.5] text-muted md:mt-2.5 md:text-[15px] md:leading-[1.55]">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex h-[240px] flex-col overflow-hidden rounded-2xl bg-green-soft md:col-start-2 md:row-span-3 md:row-start-1 md:h-auto md:min-h-[340px]">
            <div key={step} className="flex flex-1 animate-rise items-center justify-center px-4 lg:scale-[1.15]">
              <Visual step={step} onJump={setStep} />
            </div>
            <div className="px-4 pb-3 text-center text-[12px] font-semibold text-green-soft-ink">{steps[step].hint}</div>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-4 md:col-start-1 md:row-start-3">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="flex h-11 items-center gap-1 rounded-xl border border-border bg-card pr-4 pl-2.5 text-[14px] font-bold text-ink disabled:opacity-40"
            >
              <BackIcon size={18} />
              {t.help.previous}
            </button>
            <span className="text-[13px] text-muted">
              {step + 1} / {count}
            </span>
            <button
              ref={nextRef}
              type="button"
              onClick={() => (last ? setOpen(false) : setStep((s) => s + 1))}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-green pr-3 pl-4 text-[14px] font-bold text-white"
            >
              {last ? t.help.getStarted : t.help.next}
              <ArrowRightIcon size={16} />
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

const mini = "rounded-xl bg-card shadow-[0_1px_2px_rgba(28,31,29,0.08)]";
const press = "transition-transform active:scale-95";
const dashed = "rounded-full border-[1.5px] border-dashed border-green-ink font-bold text-green-ink";

/** True for a moment after `flash()`: the "Copied" blink. */
function useFlash(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    const id = setTimeout(() => setOn(false), 1200);
    return () => clearTimeout(id);
  }, [on]);
  return [on, () => setOn(true)];
}

function Chip({ name, color }: { name: string; color: number }) {
  return (
    <span className="inline-flex h-8 animate-pop items-center gap-1.5 rounded-full bg-card pr-3 pl-1 text-[13px] font-bold text-ink shadow-[0_1px_2px_rgba(28,31,29,0.08)]">
      <Avatar name={name} color={color} size={24} />
      {name}
    </span>
  );
}

function Paper({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("bg-[#fffdf6] px-3 py-2.5 font-mono text-[10px] leading-[1.55] text-[#26231f] shadow-[0_2px_6px_rgba(0,0,0,0.12)]", className)}>{children}</div>;
}

/** Each step is a small working copy of the real screen, so people learn by tapping. */
function Visual({ step, onJump }: { step: number; onJump: (step: number) => void }) {
  switch (step) {
    case 0:
      return <Welcome onJump={onJump} />;
    case 1:
      return <PeopleDemo />;
    case 2:
      return <BillsDemo />;
    case 3:
      return <SplitDemo />;
    case 4:
      return <ReceiptDemo />;
    case 5:
      return <ShareDemo />;
    default:
      return <PayDemo />;
  }
}

function Welcome({ onJump }: { onJump: (step: number) => void }) {
  const { t } = useI18n();
  const stops: [string, number][] = [
    [t.home.people, 1],
    [t.home.bills, 2],
    [t.receipt.title, 4],
  ];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-[34px] font-extrabold tracking-[-0.03em] text-ink">
        split<span className="text-green-ink">in</span>
      </div>
      <div className="flex items-center gap-2 text-[12px] font-bold text-green-soft-ink">
        {stops.map(([label, to], i) => (
          <Fragment key={label}>
            {i > 0 ? <ArrowRightIcon size={14} /> : null}
            <button type="button" onClick={() => onJump(to)} style={{ animationDelay: `${150 + i * 140}ms` }} className={cn(mini, press, "animate-pop px-2.5 py-1.5 text-ink hover:text-green-ink")}>
              {label}
            </button>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function PeopleDemo() {
  const { t } = useI18n();
  const [count, setCount] = useState(1);
  const full = count === NAMES.length;
  return (
    <div className="flex max-w-[300px] flex-wrap justify-center gap-2">
      {NAMES.slice(0, count).map((n, i) => (
        <Chip key={n} name={n} color={i} />
      ))}
      <button type="button" onClick={() => setCount(full ? 1 : count + 1)} className={cn(press, dashed, "inline-flex h-8 items-center px-3 text-[13px]", count === 1 && "animate-nudge")}>
        {full ? t.help.replay : t.home.addPerson}
      </button>
    </div>
  );
}

// who paid and how much; the names are the first quick picks from the add-bill sheet
const BILLS: [string, number][] = [
  ["Afiq", 20160],
  ["Haziq", 18000],
  ["Haziq", 9220],
];

function BillsDemo() {
  const { t, money } = useI18n();
  const [count, setCount] = useState(1);
  const full = count === BILLS.length;
  const shown = BILLS.slice(0, count);
  return (
    <div className={cn(mini, "w-full max-w-[300px] px-3 pt-1 pb-2")}>
      {shown.map(([payer, amount], i) => (
        <div key={i} className={cn("flex animate-rise items-center justify-between py-1.5 leading-[1.35]", i > 0 && "border-t border-line")}>
          <span>
            <span className="block text-[13px] font-bold text-ink">{t.bill.quick[i]}</span>
            <span className="block text-[11px] text-muted">{fmt(t.home.billEach, { name: payer, amount: money(amount / NAMES.length) })}</span>
          </span>
          <span className="tabular text-[13px] font-extrabold text-ink">{money(amount)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-line pt-2">
        <button type="button" onClick={() => setCount(full ? 1 : count + 1)} className={cn(press, dashed, "h-7 px-2.5 text-[12px]", count === 1 && "animate-nudge")}>
          {full ? t.help.replay : `+ ${t.home.addBill}`}
        </button>
        <span className="tabular text-[13px] font-extrabold text-ink">
          <span className="mr-1.5 text-[11px] font-semibold text-muted">{t.home.total}</span>
          {money(shown.reduce((sum, b) => sum + b[1], 0))}
        </span>
      </div>
    </div>
  );
}

const SPLIT_TOTAL = 12000;
const SPLIT_FIXED = 5000;

function SplitDemo() {
  const { money, plain } = useI18n();
  const [on, setOn] = useState(NAMES.slice(0, 3));
  const [fixed, setFixed] = useState<string | null>(NAMES[0]);

  // One typed amount at a time, and only while someone else is left to take the rest.
  const pinned = fixed !== null && on.length > 1 && on.includes(fixed) ? fixed : null;
  const split = splitItem(SPLIT_TOTAL, on, pinned ? { [pinned]: SPLIT_FIXED } : {});
  const shares: Record<string, number> = split.ok ? split.shares : {};

  const toggle = (name: string) => {
    if (!on.includes(name)) setOn(NAMES.filter((n) => n === name || on.includes(n)));
    else if (on.length > 1) setOn(on.filter((n) => n !== name));
  };
  const pin = (name: string) => {
    if (!on.includes(name)) toggle(name);
    else setFixed(fixed === name ? null : name);
  };

  return (
    <div className={cn(mini, "flex w-full max-w-[280px] flex-col gap-1.5 p-3")}>
      <div className="flex items-baseline justify-between pb-0.5 text-[12px] font-bold text-muted">
        <span>Wifi</span>
        <span className="tabular text-ink">{money(SPLIT_TOTAL)}</span>
      </div>
      {NAMES.map((name) => {
        const included = on.includes(name);
        return (
          <div key={name} className="flex items-center gap-2.5">
            <button type="button" role="checkbox" aria-checked={included} onClick={() => toggle(name)} className="flex flex-1 items-center gap-2.5 text-left">
              <span className={cn("inline-flex size-5 items-center justify-center rounded-md transition-colors", included ? "bg-green text-white" : "border-2 border-dash")}>
                {included ? <CheckIcon size={12} /> : null}
              </span>
              <span className={cn("text-[13px] font-semibold", included ? "text-ink" : "text-muted")}>{name}</span>
            </button>
            <button
              type="button"
              aria-label={`${name} ${plain(shares[name] ?? 0)}`}
              onClick={() => pin(name)}
              className={cn(
                press,
                "tabular min-w-[68px] rounded-lg px-2 py-1 text-right text-[13px] font-bold",
                pinned === name ? "border-[1.5px] border-green text-ink shadow-[0_0_0_3px_var(--green-soft)]" : "border border-border bg-field text-muted",
              )}
            >
              {included ? plain(shares[name] ?? 0) : "–"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ReceiptDemo() {
  const { t, plain } = useI18n();
  const [run, setRun] = useState(0);
  const r = t.receipt;
  const print = () => setRun(run + 1);
  const balances: [string, number][] = [
    ["HAZIQ", 15375],
    ["AFIQ", 8315],
    ["NAJMI", -11845],
    ["IMANUL", -11845],
  ];
  const pays: [string, string, number][] = [
    ["NAJMI", "HAZIQ", 11845],
    ["IMANUL", "HAZIQ", 3530],
    ["IMANUL", "AFIQ", 8315],
  ];
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={r.title}
      onClick={print}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") print();
      }}
      className="w-[236px] cursor-pointer"
    >
      {/* the printer slot the paper comes out of */}
      <div className="h-1.5 rounded-full bg-[#26231f]/75" />
      <div className="overflow-hidden px-2 pb-2">
        <Paper key={run} className="animate-print">
          <div className="text-center text-[12px] font-bold tracking-[0.3em]">SPLITIN</div>
          <div className="my-1 border-t border-dashed border-[#26231f]" />
          {balances.map(([name, net]) => (
            <div key={name} className="flex justify-between font-semibold">
              <span>{name}</span>
              <span style={{ color: net > 0 ? "#176b46" : "#b4472a" }}>{net > 0 ? `${r.collects} +${plain(net)}` : `${r.owes} −${plain(-net)}`}</span>
            </div>
          ))}
          <div className="my-1 border-t-[3px] border-double border-[#26231f]" />
          {pays.map(([from, to, amount]) => (
            <div key={from + to} className="flex justify-between">
              <span>
                <span style={{ color: "#b4472a" }}>{from}</span> → <span style={{ color: "#176b46" }}>{to}</span>
              </span>
              <span>{plain(amount)}</span>
            </div>
          ))}
        </Paper>
      </div>
    </div>
  );
}

function Thumb({ className }: { className?: string }) {
  return (
    <Paper className={className}>
      <div className="text-center text-[8px] font-bold tracking-[0.2em]">SPLITIN</div>
      <div className="my-1 border-t border-dashed border-[#26231f]" />
      <div className="my-1 h-1 w-[90%] bg-[#d8d3c8]" />
      <div className="my-1 h-1 w-[70%] bg-[#d8d3c8]" />
      <div className="my-1 h-1 w-[80%] bg-[#d8d3c8]" />
      <div className="my-1 border-t border-dashed border-[#26231f]" />
      <div className="my-1 h-1.5 w-full bg-[#b9b3a8]" />
      <div className="my-1 h-1 w-[60%] bg-[#d8d3c8]" />
    </Paper>
  );
}

function ShareDemo() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const [copied, flash] = useFlash();
  const plainButton = cn(mini, "flex h-8 items-center justify-center px-3 text-[12px] font-bold text-ink");
  return (
    <div className="flex items-center gap-4">
      <div className="flex w-[112px] justify-center">
        {sent ? (
          // how it lands in the group chat: the picture, the link, two blue ticks
          <div className="animate-pop rounded-xl rounded-tr-[3px] bg-[#d9fdd3] p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.18)]">
            <Thumb className="w-[92px] shadow-none" />
            <div className="mt-1 flex items-center justify-between px-0.5 font-mono text-[9px]">
              <span className="text-[#027eb5] underline">/bill/x7Kp2m</span>
              <span className="font-sans font-bold tracking-[-0.15em] text-[#53bdeb]">✓✓</span>
            </div>
          </div>
        ) : (
          <Thumb className="w-[86px] -rotate-3" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <button type="button" aria-pressed={sent} onClick={() => setSent(!sent)} className={cn(press, "flex h-9 items-center gap-2 rounded-xl bg-green px-3 text-[12px] font-bold text-white", !sent && "animate-nudge")}>
          {sent ? <CheckIcon size={15} /> : <SendIcon size={15} />}
          WhatsApp
        </button>
        <span className={plainButton}>{t.share.saveImage}</span>
        <button type="button" onClick={flash} className={cn(press, plainButton)}>
          {copied ? t.common.copied : t.share.copyLink}
        </button>
      </div>
    </div>
  );
}

function PayDemo() {
  const { t, money } = useI18n();
  const [paid, setPaid] = useState(false);
  const [copied, flash] = useFlash();
  return (
    <div className={cn(mini, "relative flex w-full max-w-[270px] flex-col gap-2 p-3")}>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-bold text-ink">{fmt(t.friend.payStep, { n: 1, name: "Haziq" })}</span>
        <span className="tabular text-[15px] font-extrabold text-ink">{money(3530)}</span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-field px-2.5 py-1.5">
        <span>
          <span className="block text-[10px] text-muted">Maybank</span>
          <span className="tabular block text-[13px] font-extrabold text-ink">1642 0098 3321</span>
        </span>
        <button type="button" onClick={flash} className={cn(press, "rounded-md border border-border bg-card px-2 py-1 text-[11px] font-bold text-ink")}>
          {copied ? t.common.copied : t.common.copy}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setPaid(!paid)}
        className={cn(press, "flex h-8 items-center justify-center rounded-lg text-[12px] font-bold", paid ? "border border-border bg-card text-ink" : "animate-nudge bg-green text-white")}
      >
        {paid ? t.common.undo : fmt(t.friend.iPaid, { name: "Haziq" })}
      </button>
      {paid ? (
        <span className="absolute -top-2 -right-2 rotate-[8deg] animate-stamp border-2 border-stamp bg-card px-1.5 font-mono text-[11px] font-bold tracking-[0.12em] text-stamp">{t.receipt.paidStamp}</span>
      ) : null}
    </div>
  );
}
