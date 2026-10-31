"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { ArrowRightIcon, BackIcon, CheckIcon, HelpIcon, PlusIcon, SendIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { splitItem } from "@/lib/bill";
import { cn } from "@/lib/utils";

const NAMES = ["Haziq", "Najmi", "Afiq", "Imanul"];

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
        <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:grid-rows-[auto_1fr_auto] md:gap-x-7 md:gap-y-5">
          <div className="-my-[5px] flex gap-1.5 md:col-start-1 md:row-start-1" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.title}
                data-step={i}
                onClick={() => setStep(i)}
                className="group flex h-4 flex-1 cursor-pointer items-center"
              >
                <span
                  className={cn(
                    "h-1.5 w-full rounded-full transition-colors group-hover:bg-green/70",
                    i === step ? "bg-green" : i < step ? "bg-green/40" : "bg-chip",
                  )}
                />
              </span>
            ))}
          </div>
          <div className="grid md:col-start-1 md:row-start-2">
            {steps.map((s, i) => (
              <div
                key={s.title}
                aria-hidden={i !== step}
                className={cn("col-start-1 row-start-1", i === step ? "animate-rise" : "invisible")}
              >
                <div className="text-[18px] font-extrabold md:text-[22px] md:leading-[1.25] md:tracking-[-0.01em]">
                  {s.title}
                </div>
                <p className="mt-1.5 mb-0 text-[14px] leading-[1.5] text-muted md:mt-2.5 md:text-[15px] md:leading-[1.55]">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="flex h-[240px] flex-col overflow-hidden rounded-2xl bg-green-soft md:col-start-2 md:row-span-3 md:row-start-1 md:h-auto md:min-h-[340px]">
            <div key={step} className="flex flex-1 animate-rise items-center justify-center px-4 lg:scale-[1.15]">
              <Visual step={step} onJump={setStep} />
            </div>
            <div className="px-4 pb-3 text-center text-[12px] font-semibold text-green-soft-ink">
              {steps[step].hint}
            </div>
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
  return (
    <div
      className={cn(
        "bg-[#ffffff] px-3 py-2.5 font-mono text-[10px] leading-[1.55] text-[#37352f] shadow-[0_2px_6px_rgba(0,0,0,0.12)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

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
    case 6:
      return <PayDemo />;
    case 7:
      return <AddDemo />;
    case 8:
      return <JoinDemo />;
    default:
      return <HistoryDemo />;
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
            <button
              type="button"
              onClick={() => onJump(to)}
              style={{ animationDelay: `${150 + i * 140}ms` }}
              className={cn(mini, press, "animate-pop px-2.5 py-1.5 text-ink hover:text-green-ink")}
            >
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
      <button
        type="button"
        onClick={() => setCount(full ? 1 : count + 1)}
        className={cn(press, dashed, "inline-flex h-8 items-center px-3 text-[13px]", count === 1 && "animate-nudge")}
      >
        {full ? t.help.replay : t.home.addPerson}
      </button>
    </div>
  );
}

const BILLS: [string, number][] = [
  ["AFIQ", 20160],
  ["HAZIQ", 18000],
  ["HAZIQ", 9220],
];

function BillsDemo() {
  const { t, plain } = useI18n();
  const [count, setCount] = useState(1);
  const full = count === BILLS.length;
  const line = (i: number) => (
    <>
      <span className="truncate">
        {t.help.demoBills[i].toUpperCase()} · {BILLS[i][0]}
      </span>
      <span>{plain(BILLS[i][1])}</span>
    </>
  );
  return (
    <div className="flex w-full max-w-[250px] flex-col items-center gap-3">
      <div className="w-full">
        <div className="h-1.5 rounded-full bg-[#37352f]/75" />
        <div className="px-2">
          <Paper className="flex flex-col gap-0.5">
            <div className="text-center text-[12px] font-bold tracking-[0.3em]">SPLITIN</div>
            <div className="my-1 border-t border-dashed border-[#37352f]" />
            {BILLS.slice(0, count).map((_, i) => (
              <div
                key={i}
                className={cn("-mx-1 flex justify-between gap-2 rounded px-1", i === count - 1 && "animate-printed")}
              >
                {line(i)}
              </div>
            ))}
            {!full ? (
              <div className="-mx-1 flex justify-between gap-2 rounded border border-dashed border-[#c8c7c3] px-1 text-[#9b9a96]">
                {line(count)}
              </div>
            ) : null}
          </Paper>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setCount(full ? 1 : count + 1)}
        className={cn(
          press,
          "h-8 rounded-lg px-3.5 text-[12px] font-bold",
          full ? "bg-card text-ink shadow-[0_1px_2px_rgba(28,31,29,0.08)]" : "animate-nudge bg-green text-white",
        )}
      >
        {full ? t.help.replay : `${t.bill.printIt} ↵`}
      </button>
    </div>
  );
}

const SPLIT_TOTAL = 12000;
const SPLIT_FIXED = 5000;

function SplitDemo() {
  const { money, plain } = useI18n();
  const [on, setOn] = useState(NAMES.slice(0, 3));
  const [fixed, setFixed] = useState<string | null>(NAMES[0]);

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
        <span className="text-ink tabular">{money(SPLIT_TOTAL)}</span>
      </div>
      {NAMES.map((name) => {
        const included = on.includes(name);
        return (
          <div key={name} className="flex items-center gap-2.5">
            <button
              type="button"
              role="checkbox"
              aria-checked={included}
              onClick={() => toggle(name)}
              className="flex flex-1 items-center gap-2.5 text-left"
            >
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-md transition-colors",
                  included ? "bg-green text-white" : "border-2 border-dash",
                )}
              >
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
                "min-w-[68px] rounded-lg px-2 py-1 text-right text-[13px] font-bold tabular",
                pinned === name
                  ? "border-[1.5px] border-green text-ink shadow-[0_0_0_3px_var(--green-soft)]"
                  : "border border-border bg-field text-muted",
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

const PAYS: [string, string, number][] = [
  ["NAJMI", "HAZIQ", 11845],
  ["IMANUL", "HAZIQ", 3530],
  ["IMANUL", "AFIQ", 8315],
];

function ReceiptDemo() {
  const { t, plain } = useI18n();
  const [run, setRun] = useState(0);
  const r = t.receipt;
  const print = () => setRun(run + 1);
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
      <div className="h-1.5 rounded-full bg-[#37352f]/75" />
      <div className="overflow-hidden px-2 pb-2">
        <Paper key={run} className="animate-print">
          <div className="text-center text-[12px] font-bold tracking-[0.3em]">SPLITIN</div>
          <div className="my-1 border-t border-dashed border-[#37352f]" />
          <div className="flex justify-between text-[13px] font-bold">
            <span>{r.total}</span>
            <span>{plain(BILLS.reduce((sum, [, amount]) => sum + amount, 0))}</span>
          </div>
          <div className="my-1 border-t border-dashed border-[#37352f]" />
          <div className="font-bold tracking-[0.06em]">{r.settleUp}</div>
          <div className="flex justify-between">
            <span>
              <span style={{ color: "#b5413b" }}>{PAYS[0][0]}</span> {r.pays}{" "}
              <span style={{ color: "#2f7552" }}>{PAYS[0][1]}</span>
            </span>
            <span>{plain(PAYS[0][2])}</span>
          </div>
          <div>
            <span style={{ color: "#b5413b" }}>{PAYS[1][0]}</span> {r.pays}
          </div>
          {PAYS.slice(1).map(([, to, amount]) => (
            <div key={to} className="ml-1 flex justify-between border-l border-[#c8c7c3] pl-2">
              <span style={{ color: "#2f7552" }}>{to}</span>
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
      <div className="my-1 border-t border-dashed border-[#37352f]" />
      <div className="my-1 h-1 w-[90%] bg-[#e6e5e2]" />
      <div className="my-1 h-1 w-[70%] bg-[#e6e5e2]" />
      <div className="my-1 h-1 w-[80%] bg-[#e6e5e2]" />
      <div className="my-1 border-t border-dashed border-[#37352f]" />
      <div className="my-1 h-1.5 w-full bg-[#cfcecb]" />
      <div className="my-1 h-1 w-[60%] bg-[#e6e5e2]" />
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
        <button
          type="button"
          aria-pressed={sent}
          onClick={() => setSent(!sent)}
          className={cn(
            press,
            "flex h-9 items-center gap-2 rounded-xl bg-green px-3 text-[12px] font-bold text-white",
            !sent && "animate-nudge",
          )}
        >
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
  const { t, plain } = useI18n();
  const [asking, setAsking] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [paid, setPaid] = useState<number[]>([]);
  const mine = PAYS.flatMap(([from], i) => (from === me?.toUpperCase() ? [i] : []));

  if (asking) {
    return (
      <div className="flex flex-col items-center gap-2.5">
        <div className="text-[15px] font-extrabold text-ink">{t.friend.whoTitle}</div>
        <div className="flex flex-wrap justify-center gap-2">
          {NAMES.map((name, i) =>
            i === 0 || name === me ? null : (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setMe(name);
                  setPaid([]);
                  setAsking(false);
                }}
                className={cn(press, "rounded-full")}
              >
                <Chip name={name} color={i} />
              </button>
            ),
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setMe(null);
            setAsking(false);
          }}
          className="h-7 text-[12px] font-bold text-green-soft-ink"
        >
          {me ? t.friend.clearMe : t.friend.justLooking}
        </button>
      </div>
    );
  }

  const hint = me ? (mine.length > 0 ? t.friend.tapHint : null) : t.friend.chooseHint;
  return (
    <div className="flex w-full max-w-[280px] flex-col gap-1">
      <div className="flex min-h-7 items-center justify-between gap-2">
        {me ? <b className="text-[14px] font-extrabold text-ink">{fmt(t.friend.hi, { name: me })}</b> : null}
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="ml-auto h-7 text-[12px] font-bold text-green-soft-ink"
        >
          {me ? fmt(t.friend.notYou, { name: me }) : t.friend.chooseName}
        </button>
      </div>
      <Paper className="w-full">
        <div className="font-bold tracking-[0.06em]">{t.receipt.settleUp}</div>
        {hint ? <div className="font-sans text-[10px] font-semibold text-[#6b6a65]">{hint}</div> : null}
        {PAYS.map(([from, to, amount], i) => {
          const done = paid.includes(i);
          const line = (
            <>
              <span style={{ color: "#b5413b" }}>{from}</span> {t.receipt.pays}{" "}
              <span style={{ color: "#2f7552" }}>{to}</span>
              <span className="flex-1 border-b border-dotted border-[#c8c7c3]" />
              <span className={done ? "text-[#9b9a96] line-through" : ""}>{plain(amount)}</span>
              {done ? (
                <span className="absolute top-0 right-12 rotate-[-8deg] animate-stamp border-2 border-[#b5413b] bg-[#ffffff] px-1 text-[9px] font-bold tracking-[0.12em] text-[#b5413b]">
                  {t.receipt.paidStamp}
                </span>
              ) : null}
            </>
          );
          const shape = "relative -mx-1 mt-1 flex w-[calc(100%+8px)] items-baseline gap-1.5 rounded px-1 py-0.5";
          return mine.includes(i) ? (
            <button
              key={i}
              type="button"
              onClick={() => setPaid(done ? paid.filter((p) => p !== i) : [...paid, i])}
              className={cn(press, shape, "text-left font-mono", !done && "animate-nudge bg-[#f3f2ef]")}
            >
              {line}
            </button>
          ) : (
            <div key={i} className={shape}>
              {line}
            </div>
          );
        })}
      </Paper>
    </div>
  );
}

function AddDemo() {
  const { t, money } = useI18n();
  const [added, setAdded] = useState(false);

  if (!added) {
    return (
      <button
        type="button"
        onClick={() => setAdded(true)}
        className={cn(
          mini,
          press,
          "inline-flex h-10 animate-nudge items-center gap-1.5 px-3.5 text-[13px] font-bold text-ink",
        )}
      >
        <PlusIcon size={15} />
        {t.friend.addPaid}
      </button>
    );
  }

  return (
    <div className={cn(mini, "w-full max-w-[270px] animate-pop px-3 pt-2.5 pb-1")}>
      <span className="text-[10px] font-bold tracking-[0.06em] text-faint uppercase">{t.friend.yours}</span>
      <div className="flex items-center justify-between gap-2 py-2">
        <span className="min-w-0 truncate text-[13px] text-ink">
          <b>{t.help.demoBills[1]}</b>
          <span className="text-muted"> · {money(5000)}</span>
        </span>
        <button
          type="button"
          onClick={() => setAdded(false)}
          className={cn(
            press,
            "h-7 shrink-0 animate-nudge rounded-lg border border-border bg-card px-2.5 text-[12px] font-bold text-owe",
          )}
        >
          {t.friend.deleteMine}
        </button>
      </div>
    </div>
  );
}

function JoinDemo() {
  const { t, money } = useI18n();
  const [picked, setPicked] = useState([true, false, false]);
  const bills: [string, number, number][] = [
    [t.help.demoBills[0], 20160, 4032],
    [t.help.demoBills[1], 18000, 3600],
    [t.help.demoBills[2], 9220, 1844],
  ];
  const all = picked.every(Boolean);
  const total = bills.reduce((sum, [, , share], i) => sum + (picked[i] ? share : 0), 0);
  return (
    <div className={cn(mini, "flex w-full max-w-[280px] flex-col gap-1 p-3")}>
      <div className="flex items-baseline justify-between pb-0.5">
        <span className="text-[12px] font-extrabold text-ink">{t.join.title}</span>
      </div>
      {bills.map(([name, amount, share], i) => (
        <button
          key={name}
          type="button"
          role="checkbox"
          aria-checked={picked[i]}
          onClick={() => setPicked(picked.map((on, j) => (j === i ? !on : on)))}
          className="flex items-center gap-2.5 text-left"
        >
          <span
            className={cn(
              "inline-flex size-5 shrink-0 items-center justify-center rounded-md transition-colors",
              picked[i] ? "bg-green text-white" : "border-2 border-dash",
            )}
          >
            {picked[i] ? <CheckIcon size={12} /> : null}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">
            {name} <span className="font-normal text-muted">· {money(amount)}</span>
          </span>
          <span className={cn("text-[12.5px] font-bold tabular", picked[i] ? "text-ink" : "text-faint")}>
            {money(share)}
          </span>
        </button>
      ))}
      <div className="mt-1 flex items-center justify-between border-t border-line pt-1.5">
        <button
          type="button"
          onClick={() => setPicked(picked.map(() => !all))}
          className={cn(press, "h-6 text-[12px] font-bold text-green-ink", !all && "animate-nudge")}
        >
          {all ? t.join.none : t.join.all}
        </button>
        <span className="text-[12px] text-muted">
          {t.join.you} <b className="text-[14px] text-ink tabular">{money(total)}</b>
        </span>
      </div>
    </div>
  );
}

function HistoryDemo() {
  const { t, money } = useI18n();
  const h = t.history;
  const [count, setCount] = useState(1);
  const rows = [
    fmt(h.itemAdded, { who: "Afiq", name: t.help.demoBills[1], amount: money(5000), payer: "Afiq" }),
    fmt(h.paid, { who: "Najmi", from: "Najmi", to: "Haziq", amount: money(11845) }),
    `${fmt(h.itemEdited, { who: "Haziq", name: "Wifi" })}: ${fmt(h.changeAmount, { from: money(9220), to: money(12000) })}`,
  ];
  const next = () => setCount(count === rows.length ? 1 : count + 1);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={h.title}
      onClick={next}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") next();
      }}
      className={cn(mini, "w-full max-w-[290px] cursor-pointer px-3 py-2.5")}
    >
      <div className="pb-0.5 text-[13px] font-extrabold text-ink">
        {h.title} · {count}
      </div>
      {rows
        .slice(0, count)
        .reverse()
        .map((row, i) => (
          <div
            key={row}
            className={cn(
              "py-1.5 text-[12px] leading-[1.4] text-ink",
              i === 0 ? "animate-rise" : "border-t border-line",
            )}
          >
            {row}
          </div>
        ))}
    </div>
  );
}
