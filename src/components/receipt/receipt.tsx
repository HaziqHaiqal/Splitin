"use client";

import { forwardRef, useId } from "react";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { evenShare, itemNote, summarize, type BillDoc, type Payment, type PlanLine } from "@/lib/bill";

const INK = "#26231f";
const MUTED = "#6d675e";
const RED = "#b4472a";
const GREEN = "#176b46";

export function Zigzag({ edge }: { edge: "top" | "bottom" }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    // overlaps the paper by 1px so no hairline seam shows between the teeth and the paper in the picture
    <svg width="100%" height="8" preserveAspectRatio="none" aria-hidden className={edge === "top" ? "-mb-px block" : "-mt-px block"}>
      <defs>
        <pattern id={`zz${id}`} width="10" height="8" patternUnits="userSpaceOnUse">
          <path d={edge === "top" ? "M0 8 L5 0 L10 8 Z" : "M0 0 L5 8 L10 0 Z"} fill="#fffdf6" />
        </pattern>
      </defs>
      <rect width="100%" height="8" fill={`url(#zz${id})`} />
    </svg>
  );
}

const BARS = [3, 1.5, 4, 1.5, 2.5, 1.5, 5, 1.5, 3, 1.5, 2, 4, 1.5, 3, 1.5, 5, 2, 1.5, 3, 4, 1.5, 2.5, 1.5, 5, 1.5, 3, 2, 4, 1.5, 3, 1.5, 5, 1.5, 2.5, 1.5, 4, 2, 1.5, 3, 1.5, 5, 1.5, 3, 2];

const BAR_X = BARS.reduce<number[]>((xs, w, i) => [...xs, i === 0 ? 0 : xs[i - 1] + BARS[i - 1] + ((i - 1) % 3 === 0 ? 2 : 2.5)], []);
const BAR_WIDTH = BAR_X[BAR_X.length - 1] + BARS[BARS.length - 1];

function Barcode() {
  return (
    <svg width="230" height="34" viewBox={`0 0 ${BAR_WIDTH} 34`} aria-hidden className="self-center">
      <g fill={INK}>
        {BARS.map((w, i) => (
          <rect key={i} x={BAR_X[i]} width={w} height={34} />
        ))}
      </g>
    </svg>
  );
}

const Dashed = ({ double }: { double?: boolean }) => (
  <div
    style={
      double
        ? { borderTop: `1.5px solid ${INK}`, borderBottom: `1.5px solid ${INK}`, height: 5, margin: "10px 0 8px" }
        : { borderTop: `1.5px dashed ${INK}`, margin: "10px 0 8px" }
    }
  />
);

function Leader({ left, right, bold }: { left: React.ReactNode; right: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex gap-1.5" style={{ fontWeight: bold ? 600 : undefined }}>
      <span>{left}</span>
      <span className="flex-1" style={{ borderBottom: "1.5px dotted #b5afa4", marginBottom: 5 }} />
      <span>{right}</span>
    </div>
  );
}

export type ReceiptProps = {
  doc: BillDoc;
  payments?: Payment[];
  billId?: string | null;
  expiresAt?: string | null;
  /** "SHARED BY HAZIQ · 05/10/2026" instead of time + number */
  sharedBy?: string | null;
  /** Makes each unpaid payment under SETTLE UP tappable (the shared link, for friends). */
  onLine?: (line: PlanLine) => void;
  /** A short grey line under SETTLE UP explaining the tap. */
  hint?: string;
};

/** The thermal-receipt look. Paper colours stay the same in dark mode. */
export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(function Receipt({ doc, payments = [], billId, expiresAt, sharedBy, onLine, hint }, ref) {
  const { t, plain, money, date } = useI18n();
  const r = t.receipt;
  const summary = summarize(doc, payments);
  const name = (id: string) => doc.people.find((p) => p.id === id)?.name.toUpperCase() ?? "?";
  const created = date(doc.createdAt, { day: "2-digit", month: "2-digit", year: "numeric" });
  const createdTime = date(doc.createdAt, { hour: "2-digit", minute: "2-digit", hour12: false });

  const notes: { mark: string; text: string }[] = [];
  const rows = doc.items.map((item) => {
    const each = evenShare(item, doc.people.length);
    let mark = "";
    if (each === null) {
      mark = "*".repeat(notes.length + 1);
      const text = itemNote(item, doc.people, plain, { others: r.others, not: r.not });
      if (text) notes.push({ mark, text });
    }
    return { item, each, mark };
  });

  const lines = [
    ...summary.done.map((l) => ({ ...l, paid: true })),
    ...summary.remaining.map((l) => ({ ...l, paid: false })),
  ];
  const receivers = [...new Set(lines.map((l) => l.to))]
    .map((id) => doc.people.find((p) => p.id === id))
    .filter((p) => p && p.bank && p.accountNo);
  const host = typeof window === "undefined" ? "" : window.location.host;

  return (
    <div ref={ref} style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.12))" }}>
      <Zigzag edge="top" />
      <div
        className="flex flex-col gap-0.5 font-mono"
        style={{ background: "#fffdf6", padding: "18px 18px 20px", fontSize: 12.5, lineHeight: 1.6, color: INK }}
      >
        <div className="text-center" style={{ fontSize: 19, fontWeight: 700, letterSpacing: "0.32em", paddingLeft: "0.32em" }}>
          SPLITIN
        </div>
        <div className="text-center" style={{ fontWeight: 600 }}>
          {doc.title.toUpperCase()}
        </div>
        <div className="text-center" style={{ color: MUTED, fontSize: 11.5 }}>
          {sharedBy ? `${fmt(r.sharedBy, { name: sharedBy.toUpperCase() })} · ${created}` : `${created} ${createdTime}${billId ? ` · ${r.no} ${billId.toUpperCase()}` : ""}`}
        </div>
        <Dashed />

        <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) 52px 54px 62px", columnGap: 6, rowGap: 4 }}>
          <span style={{ color: MUTED, fontSize: 11 }}>{r.item}</span>
          <span style={{ color: MUTED, fontSize: 11 }}>{r.by}</span>
          <span style={{ color: MUTED, fontSize: 11, textAlign: "right" }}>{r.each}</span>
          <span style={{ color: MUTED, fontSize: 11, textAlign: "right" }}>{r.total}</span>
          {rows.map(({ item, each, mark }) => (
            <div key={item.id} className="contents">
              <span className="truncate">{item.name.toUpperCase()}</span>
              <span className="truncate">{name(item.paidBy)}</span>
              <span style={{ textAlign: "right" }}>{each !== null ? `${each.exact ? "" : "~"}${plain(each.amount)}` : mark}</span>
              <span style={{ textAlign: "right" }}>{plain(item.amountMinor)}</span>
            </div>
          ))}
        </div>
        {notes.map((n) => (
          <div key={n.mark} style={{ color: MUTED, fontSize: 11.5, paddingLeft: 10 }}>
            {n.mark} {n.text}
          </div>
        ))}
        <Dashed />
        <div className="flex justify-between" style={{ fontSize: 16, fontWeight: 700 }}>
          <span>{r.total}</span>
          <span>{money(summary.total)}</span>
        </div>

        {summary.sameShare !== null ? (
          <>
            <div className="flex justify-between" style={{ fontWeight: 600 }}>
              <span>{fmt(r.peopleEach, { count: doc.people.length })}</span>
              <span>{money(summary.sameShare)}</span>
            </div>
            <Dashed />
            <div style={{ color: MUTED, fontSize: 11 }}>{r.balance}</div>
            <div className="grid" style={{ gridTemplateColumns: "70px minmax(0,1fr) auto", columnGap: 8, rowGap: 2, fontWeight: 600 }}>
              {[...summary.people]
                .filter((p) => p.net !== 0)
                .sort((a, b) => b.net - a.net)
                .map((p) => (
                  <div key={p.id} className="contents">
                    <span className="truncate">{name(p.id)}</span>
                    <span style={{ color: p.net > 0 ? GREEN : RED }}>{p.net > 0 ? r.collects : r.owes}</span>
                    <span style={{ color: p.net > 0 ? GREEN : RED, textAlign: "right" }}>
                      {p.net > 0 ? "+" : "−"}
                      {plain(Math.abs(p.net))}
                    </span>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <>
            <Dashed />
            <div className="grid" style={{ gridTemplateColumns: "70px minmax(0,1fr) auto", columnGap: 8, rowGap: 2 }}>
              <span style={{ color: MUTED, fontSize: 11 }}>{r.name}</span>
              <span style={{ color: MUTED, fontSize: 11, textAlign: "right" }}>{r.shareCol}</span>
              <span style={{ color: MUTED, fontSize: 11, textAlign: "right" }}>{r.balance}</span>
              {summary.people.map((p) => (
                <div key={p.id} className="contents">
                  <span className="truncate">{name(p.id)}</span>
                  <span style={{ textAlign: "right" }}>{plain(p.share)}</span>
                  <span style={{ textAlign: "right", fontWeight: 700, color: p.net > 0 ? GREEN : p.net < 0 ? RED : MUTED }}>
                    {p.net > 0 ? "+" : p.net < 0 ? "−" : ""}
                    {plain(Math.abs(p.net))}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
              <span style={{ color: GREEN }}>{r.legend.split(" · ")[0]}</span> · <span style={{ color: RED }}>{r.legend.split(" · ")[1]}</span>
            </div>
          </>
        )}
        <Dashed double />

        <div style={{ fontWeight: 700, letterSpacing: "0.06em" }}>
          {lines.length === 0 ? r.nothingToSettle : lines.length === 1 ? r.settleUpOne : fmt(r.settleUp, { count: lines.length })}
        </div>
        {hint ? <div className="font-sans text-[11.5px] font-semibold" style={{ color: MUTED }}>{hint}</div> : null}
        <div className="mt-1.5 flex flex-col gap-2">
          {lines.map((l) => {
            const leader = (
              <Leader
                bold
                left={
                  <>
                    <span style={{ color: RED }}>{name(l.from)}</span> → <span style={{ color: GREEN }}>{name(l.to)}</span>
                  </>
                }
                right={
                  <span style={l.paid ? { textDecoration: "line-through", color: MUTED } : undefined}>
                    {plain(l.amount)}
                    {onLine && !l.paid ? <span style={{ color: MUTED, marginLeft: 6 }}>›</span> : null}
                  </span>
                }
              />
            );
            if (onLine && !l.paid) {
              return (
                <button
                  key={`${l.from}-${l.to}-open`}
                  type="button"
                  onClick={() => onLine(l)}
                  aria-label={`${name(l.from)} → ${name(l.to)} ${plain(l.amount)}`}
                  className="-mx-1.5 block rounded-md bg-[#f1ecdd] px-1.5 py-1 text-left font-mono transition-colors hover:bg-[#e9e2cc]"
                >
                  {leader}
                </button>
              );
            }
            return (
            <div key={`${l.from}-${l.to}-${l.paymentId ?? "x"}`} className="relative">
              {leader}
              {l.paid ? (
                <span
                  className="absolute"
                  style={{ right: 58, top: -2, transform: "rotate(-8deg)", border: "2px solid #c2412b", color: "#c2412b", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", padding: "0 4px", background: "#fffdf6" }}
                >
                  {r.paidStamp}
                </span>
              ) : null}
            </div>
            );
          })}
        </div>

        {receivers.length > 0 ? (
          <>
            <Dashed />
            <div style={{ color: MUTED, fontSize: 11 }}>{r.payTo}</div>
            <div className="grid" style={{ gridTemplateColumns: "64px minmax(0,1fr)", columnGap: 8, rowGap: 6 }}>
              {receivers.map((p) => (
                <div key={p!.id} className="contents">
                  <span className="truncate" style={{ fontWeight: 700 }}>
                    {p!.name.toUpperCase()}
                  </span>
                  <span>
                    {p!.bank!.toUpperCase()}
                    <br />
                    {p!.accountNo}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : null}
        <div style={{ borderTop: `1.5px dashed ${INK}`, margin: "12px 0" }} />
        <Barcode />
        {billId ? (
          <div className="text-center" style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
            {host}/bill/{billId}
            {expiresAt ? ` · ${fmt(r.validTo, { date: date(expiresAt, { day: "2-digit", month: "2-digit", year: "numeric" }) })}` : ""}
          </div>
        ) : null}
        <div className="text-center" style={{ fontWeight: 600, marginTop: 6 }}>
          {r.thanks}
        </div>
      </div>
      <Zigzag edge="bottom" />
    </div>
  );
});
