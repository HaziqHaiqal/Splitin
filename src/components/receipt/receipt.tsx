"use client";

import { forwardRef, Fragment, useId, type ReactNode } from "react";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { itemSplitText, summarize, type BillDoc, type Item, type Payment, type PlanLine } from "@/lib/bill";

const INK = "#37352f";
const MUTED = "#6b6a65";
const RED = "#b5413b";
const GREEN = "#2f7552";

export function Zigzag({ edge }: { edge: "top" | "bottom" }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      width="100%"
      height="8"
      preserveAspectRatio="none"
      aria-hidden
      className={edge === "top" ? "-mb-px block" : "-mt-px block"}
    >
      <defs>
        <pattern id={`zz${id}`} width="10" height="8" patternUnits="userSpaceOnUse">
          <path d={edge === "top" ? "M0 8 L5 0 L10 8 Z" : "M0 0 L5 8 L10 0 Z"} fill="#ffffff" />
        </pattern>
      </defs>
      <rect width="100%" height="8" fill={`url(#zz${id})`} />
    </svg>
  );
}

const BARS = [
  3, 1.5, 4, 1.5, 2.5, 1.5, 5, 1.5, 3, 1.5, 2, 4, 1.5, 3, 1.5, 5, 2, 1.5, 3, 4, 1.5, 2.5, 1.5, 5, 1.5, 3, 2, 4, 1.5, 3,
  1.5, 5, 1.5, 2.5, 1.5, 4, 2, 1.5, 3, 1.5, 5, 1.5, 3, 2,
];

const BAR_X = BARS.reduce<number[]>(
  (xs, w, i) => [...xs, i === 0 ? 0 : xs[i - 1] + BARS[i - 1] + ((i - 1) % 3 === 0 ? 2 : 2.5)],
  [],
);
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

export function BigStamp({ children }: { children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute top-[38%] left-1/2 animate-stamp border-4 px-4 py-0.5 font-mono text-[30px] font-bold tracking-[0.14em] whitespace-nowrap"
      style={{
        borderColor: "#b5413b",
        color: "#b5413b",
        background: "rgba(255,255,255,0.65)",
        transform: "translate(-50%, -50%) rotate(-12deg)",
      }}
    >
      {children}
    </div>
  );
}

const TREE = "#c8c7c3";

const BY_COL = 70;
const TOTAL_COL = 66;
const COL_GAP = 8;

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
      <span className="flex-1" style={{ borderBottom: "1.5px dotted #c8c7c3", marginBottom: 5 }} />
      <span>{right}</span>
    </div>
  );
}

export type ReceiptProps = {
  doc: BillDoc;
  payments?: Payment[];
  billId?: string | null;
  expiresAt?: string | null;
  sharedBy?: string | null;
  onLine?: (line: PlanLine) => void;
  hint?: string;
  variant?: "draft" | "full";
  people?: { key: number; fresh?: boolean } | null;
  preview?: Item | null;
  freshItemId?: string | null;
  onItem?: (item: Item) => void;
  bigStamp?: string;
};

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(function Receipt(
  {
    doc,
    payments = [],
    billId,
    expiresAt,
    sharedBy,
    onLine,
    hint,
    variant = "full",
    people,
    preview,
    freshItemId,
    onItem,
    bigStamp,
  },
  ref,
) {
  const draft = variant === "draft";
  const { t, plain, money, date, time } = useI18n();
  const r = t.receipt;
  const summary = summarize(doc, payments);
  const name = (id: string) => doc.people.find((p) => p.id === id)?.name.toUpperCase() ?? "?";
  const created = date(doc.createdAt, { day: "2-digit", month: "2-digit", year: "numeric" });
  const createdTime = time(doc.createdAt);

  const splitWords = { each: r.each, about: r.about, others: r.others, not: r.not };
  const rows = doc.items.map((item) => ({ item, detail: itemSplitText(item, doc.people, plain, splitWords) }));
  const previewDetail = preview && preview.amountMinor > 0 ? itemSplitText(preview, doc.people, plain, splitWords) : "";

  const billLine = (item: Item, detail: string, kind: "plain" | "fresh" | "ghost") => {
    const body = (
      <>
        <span
          className="grid"
          style={{ gridTemplateColumns: `minmax(0,1fr) ${BY_COL}px ${TOTAL_COL}px`, columnGap: COL_GAP }}
        >
          <span className="truncate">{item.name.trim() ? item.name.toUpperCase() : "…"}</span>
          <span className="truncate">{name(item.paidBy)}</span>
          <span style={{ textAlign: "right" }}>{item.amountMinor > 0 ? plain(item.amountMinor) : "–"}</span>
        </span>
        {detail ? (
          <span
            className="block"
            style={{
              color: MUTED,
              fontSize: 11.5,
              lineHeight: 1.45,
              paddingLeft: 10,
              paddingRight: BY_COL + TOTAL_COL + COL_GAP * 2,
            }}
          >
            {detail.split(" · ").map((part, i) => (
              <Fragment key={i}>
                {i > 0 ? " · " : ""}
                <span className="whitespace-nowrap">{part}</span>
              </Fragment>
            ))}
          </span>
        ) : null}
      </>
    );
    const shape = cn(
      "-mx-1.5 block w-[calc(100%+12px)] rounded px-1.5 py-1 text-left font-mono",
      kind === "fresh" && "animate-printed",
      kind === "ghost" && "border-[1.5px] border-dashed opacity-60",
    );
    if (onItem && kind !== "ghost") {
      return (
        <button key={item.id} type="button" onClick={() => onItem(item)} className={cn(shape, "hover:bg-[#f3f2ef]")}>
          {body}
        </button>
      );
    }
    return (
      <span key={item.id} className={shape} style={kind === "ghost" ? { borderColor: "#c8c7c3" } : undefined}>
        {body}
      </span>
    );
  };

  const lines = [
    ...summary.done.map((l) => ({ ...l, paid: true })),
    ...summary.remaining.map((l) => ({ ...l, paid: false })),
  ];
  const groups = doc.people.map((p) => lines.filter((l) => l.from === p.id)).filter((g) => g.length > 0);
  const receivers = [...new Set(lines.map((l) => l.to))]
    .map((id) => doc.people.find((p) => p.id === id))
    .filter((p) => p && p.bank && p.accountNo);
  const host = typeof window === "undefined" ? "" : window.location.host;

  return (
    <div ref={ref} className="relative" style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.12))" }}>
      <Zigzag edge="top" />
      <div
        className="flex flex-col gap-0.5 font-mono"
        style={{ background: "#ffffff", padding: "18px 18px 20px", fontSize: 12.5, lineHeight: 1.6, color: INK }}
      >
        <div
          className="text-center"
          style={{ fontSize: 19, fontWeight: 700, letterSpacing: "0.32em", paddingLeft: "0.32em" }}
        >
          SPLITIN
        </div>
        <div className="text-center" style={{ fontWeight: 600 }}>
          {doc.title.toUpperCase()}
        </div>
        {draft ? null : (
          <div className="text-center" style={{ color: MUTED, fontSize: 11.5 }}>
            {sharedBy
              ? `${fmt(r.sharedBy, { name: sharedBy.toUpperCase() })} · ${created}`
              : `${created} ${createdTime}`}
          </div>
        )}
        {draft && people && doc.people.length > 0 ? (
          <>
            <Dashed />
            <div key={people.key} className={cn("-mx-1.5 rounded px-1.5", people.fresh && "animate-printed")}>
              {doc.people.map((p) => p.name.toUpperCase()).join(" · ")}
            </div>
          </>
        ) : null}
        {draft && rows.length === 0 && !preview ? null : <Dashed />}

        {draft && rows.length === 0 && !preview ? null : (
          <div className="flex flex-col gap-0.5">
            <span
              className="grid"
              style={{
                gridTemplateColumns: `minmax(0,1fr) ${BY_COL}px ${TOTAL_COL}px`,
                columnGap: COL_GAP,
                color: MUTED,
                fontSize: 11,
              }}
            >
              <span>{r.item}</span>
              <span>{r.by}</span>
              <span style={{ textAlign: "right" }}>{r.total}</span>
            </span>
            {rows.map(({ item, detail }) =>
              preview?.id === item.id
                ? billLine(preview, previewDetail, "ghost")
                : billLine(item, detail, item.id === freshItemId ? "fresh" : "plain"),
            )}
            {preview && !doc.items.some((i) => i.id === preview.id) ? billLine(preview, previewDetail, "ghost") : null}
          </div>
        )}
        {draft ? (
          <>
            <div style={{ borderTop: `1.5px dashed ${INK}`, margin: "12px 0 8px" }} />
            <div className="text-center" style={{ fontWeight: 600 }}>
              {r.thanks}
            </div>
          </>
        ) : (
          <>
            <Dashed />
            <div className="flex justify-between" style={{ fontSize: 16, fontWeight: 700 }}>
              <span>{r.total}</span>
              <span>{money(summary.total)}</span>
            </div>

            {summary.sameShare !== null ? (
              <div className="flex justify-between" style={{ fontWeight: 600 }}>
                <span>{fmt(r.peopleEach, { count: doc.people.length })}</span>
                <span>{money(summary.sameShare)}</span>
              </div>
            ) : null}
            <Dashed double />

            <div style={{ fontWeight: 700, letterSpacing: "0.06em" }}>
              {lines.length === 0 ? r.nothingToSettle : r.settleUp}
            </div>
            {hint ? (
              <div className="font-sans text-[11.5px] font-semibold" style={{ color: MUTED }}>
                {hint}
              </div>
            ) : null}
            <div className="mt-1.5 flex flex-col gap-2">
              {groups.map((group) => {
                const branched = group.length > 1;
                const lineFor = (l: (typeof lines)[number], i: number) => {
                  const leader = (
                    <Leader
                      bold
                      left={
                        branched ? (
                          <span style={{ color: GREEN }}>{name(l.to)}</span>
                        ) : (
                          <>
                            <span style={{ color: RED }}>{name(l.from)}</span>{" "}
                            <span style={{ fontWeight: 400 }}>{r.pays}</span>{" "}
                            <span style={{ color: GREEN }}>{name(l.to)}</span>
                          </>
                        )
                      }
                      right={
                        <span style={l.paid ? { textDecoration: "line-through", color: MUTED } : undefined}>
                          {plain(l.amount)}
                          {onLine && !l.paid ? <span style={{ color: MUTED, marginLeft: 6 }}>›</span> : null}
                        </span>
                      }
                    />
                  );
                  const node =
                    onLine && !l.paid ? (
                      <button
                        key={`${l.from}-${l.to}-open`}
                        type="button"
                        onClick={() => onLine(l)}
                        aria-label={`${name(l.from)} ${r.pays} ${name(l.to)} ${plain(l.amount)}`}
                        className="-mx-1.5 block w-[calc(100%+12px)] rounded-md bg-[#f3f2ef] px-1.5 py-1 text-left font-mono transition-colors hover:bg-[#ebeae6]"
                      >
                        {leader}
                      </button>
                    ) : (
                      <div key={`${l.from}-${l.to}-${l.paymentId ?? "x"}`} className="relative">
                        {leader}
                        {l.paid ? (
                          <span
                            className="absolute"
                            style={{
                              right: 58,
                              top: -2,
                              transform: "rotate(-8deg)",
                              border: "2px solid #b5413b",
                              color: "#b5413b",
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.12em",
                              padding: "0 4px",
                              background: "#ffffff",
                            }}
                          >
                            {r.paidStamp}
                          </span>
                        ) : null}
                      </div>
                    );
                  if (!branched) return node;
                  const last = i === group.length - 1;
                  return (
                    <div key={`${l.from}-${l.to}-branch`} className="relative" style={{ paddingLeft: 18 }}>
                      <span
                        aria-hidden
                        className="absolute"
                        style={{
                          left: 5,
                          top: -6,
                          height: last ? "calc(50% + 6px)" : "calc(100% + 6px)",
                          borderLeft: `1.5px solid ${TREE}`,
                        }}
                      />
                      <span
                        aria-hidden
                        className="absolute"
                        style={{ left: 5, top: "50%", width: 9, borderTop: `1.5px solid ${TREE}` }}
                      />
                      {node}
                    </div>
                  );
                };
                if (!branched) return lineFor(group[0], 0);
                return (
                  <div key={group[0].from} className="flex flex-col gap-1">
                    <div style={{ fontWeight: 600 }}>
                      <span style={{ color: RED }}>{name(group[0].from)}</span>{" "}
                      <span style={{ fontWeight: 400 }}>{r.pays}</span>
                    </div>
                    {group.map(lineFor)}
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
                {expiresAt
                  ? ` · ${fmt(r.validTo, { date: date(expiresAt, { day: "2-digit", month: "2-digit", year: "numeric" }) })}`
                  : ""}
              </div>
            ) : null}
            <div className="text-center" style={{ fontWeight: 600, marginTop: 6 }}>
              {r.thanks}
            </div>
          </>
        )}
      </div>
      <Zigzag edge="bottom" />
      {bigStamp ? <BigStamp>{bigStamp}</BigStamp> : null}
    </div>
  );
});
