"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { fmt, intlLocale } from "@/i18n";
import { useI18n } from "@/i18n/client";
import type { BillDoc, Payment } from "@/lib/bill";
import { avatarColor, cn } from "@/lib/utils";
import { workings, type Change, type Debt } from "@/lib/workings";

type Tone = "new" | "old" | "faint" | "ink" | "gone";
type Edge = { from: string; to: string; label: string; tone: Tone };

const W = 340;
const H = 300;
const ROWS = [64, 246];

const STROKE: Record<Tone, string> = {
  new: "var(--green)",
  old: "var(--border)",
  faint: "var(--line)",
  ink: "var(--ink)",
  gone: "var(--faint)",
};

type Box = { x: number; y: number; w: number; h: number };
const hits = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function Flow({
  doc,
  top,
  bottom,
  edges,
  badges,
}: {
  doc: BillDoc;
  top: string[];
  bottom: string[];
  edges: Edge[];
  badges?: Record<string, number>;
}) {
  const { plain } = useI18n();
  const uid = useId().replace(/:/g, "");
  const nodes = new Map<string, { x: number; y: number; w: number; row: number; i: number }>();
  [top, bottom].forEach((row, r) => {
    const w = Math.min(66, W / row.length - 8);
    const start = Math.max(w / 2 + 4, 38);
    row.forEach((id, i) =>
      nodes.set(id, {
        x: row.length === 1 ? W / 2 : start + (i * (W - 2 * start)) / (row.length - 1),
        y: ROWS[r],
        w,
        row: r,
        i,
      }),
    );
  });
  const boxes: Box[] = [...nodes.values()].map((n) => ({ x: n.x - n.w / 2, y: n.y - 16, w: n.w, h: 32 }));

  const trim = (from: { x: number; y: number }, to: { x: number; y: number }, w: number, extra: number) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const r = 1 / Math.hypot(dx / len / (w / 2 + 2), dy / len / 18) + extra;
    return { x: from.x + (dx / len) * r, y: from.y + (dy / len) * r };
  };

  const lines = edges.flatMap((e, k) => {
    const a = nodes.get(e.from);
    const b = nodes.get(e.to);
    if (!a || !b) return [];
    const bend =
      a.row === b.row && Math.abs(a.i - b.i) > 1 ? (a.row === 0 ? -1 : 1) * (18 + 8 * Math.abs(a.i - b.i)) : 0;
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + bend * 2 };
    const s = trim(a, bend ? c : b, a.w, 0);
    const t = trim(b, bend ? c : a, b.w, 2);
    const at = (p: number) => ({
      x: (1 - p) ** 2 * a.x + 2 * (1 - p) * p * c.x + p ** 2 * b.x,
      y: (1 - p) ** 2 * a.y + 2 * (1 - p) * p * c.y + p ** 2 * b.y,
    });
    let label: { x: number; y: number; w: number } | null = null;
    if (e.label) {
      const w = e.label.length * 6.6 + 14;
      const spots = [
        ...[0.5, 0.35, 0.65, 0.25, 0.75, 0.42, 0.58].map((p) => [p, 0]),
        ...[0.5, 0.35, 0.65].flatMap((p) => [
          [p, -28],
          [p, 28],
        ]),
      ].map(([p, dy]) => {
        const m = at(p);
        return { x: Math.min(W - w / 2 - 2, Math.max(w / 2 + 2, m.x)), y: m.y + dy, w };
      });
      label =
        spots.find((p) => !boxes.some((o) => hits(o, { x: p.x - w / 2 - 2, y: p.y - 12, w: w + 4, h: 24 }))) ??
        spots[0];
      boxes.push({ x: label.x - w / 2, y: label.y - 10, w, h: 20 });
    }
    return [{ e, k, d: `M${s.x} ${s.y}Q${c.x} ${c.y} ${t.x} ${t.y}`, label }];
  });

  const tones = [...new Set(edges.map((e) => e.tone))];
  const nameOf = (id: string) => doc.people.find((p) => p.id === id);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" aria-hidden>
      <defs>
        {tones.map((tone) => (
          <marker
            key={tone}
            id={`${uid}-${tone}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerUnits="userSpaceOnUse"
            markerWidth="9"
            markerHeight="9"
            orient="auto"
          >
            <path d="M0 0L10 5L0 10z" style={{ fill: STROKE[tone] }} />
          </marker>
        ))}
      </defs>
      {lines.map(({ e, k, d }) => (
        <path
          key={k}
          d={d}
          fill="none"
          strokeWidth={e.tone === "new" || e.tone === "ink" ? 2.5 : 1.5}
          strokeDasharray={e.tone === "gone" ? "4 4" : undefined}
          markerEnd={e.tone === "gone" ? undefined : `url(#${uid}-${e.tone})`}
          style={{ stroke: STROKE[e.tone] }}
        />
      ))}
      {lines.map(({ e, k, label }) =>
        label ? (
          <g key={k}>
            <rect
              x={label.x - label.w / 2}
              y={label.y - 10}
              width={label.w}
              height={20}
              rx={10}
              style={{ fill: "var(--card)", stroke: e.tone === "old" ? "var(--border)" : STROKE[e.tone] }}
            />
            <text
              x={label.x}
              y={label.y + 4}
              textAnchor="middle"
              fontSize="11.5"
              fontWeight="800"
              style={{ fill: e.tone === "old" || e.tone === "gone" ? "var(--faint)" : STROKE[e.tone] }}
            >
              {e.label}
            </text>
          </g>
        ) : null,
      )}
      {[...nodes].map(([id, n]) => {
        const person = nameOf(id);
        const c = avatarColor(person?.color ?? 0);
        const name = person?.name ?? "?";
        const fits = Math.max(2, Math.floor((n.w - 10) / 7.2));
        const net = badges?.[id];
        const by = n.row === 0 ? n.y - 38 : n.y + 22;
        return (
          <g key={id}>
            <rect x={n.x - n.w / 2} y={n.y - 16} width={n.w} height={32} rx={16} fill={c.bg} />
            <text x={n.x} y={n.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="800" fill={c.fg}>
              {name.length > fits ? `${name.slice(0, fits - 1)}…` : name}
            </text>
            {net === undefined ? null : (
              <g>
                <rect
                  x={n.x - 36}
                  y={by}
                  width={72}
                  height={18}
                  rx={9}
                  style={{
                    fill:
                      net > 0
                        ? "var(--green-soft)"
                        : net < 0
                          ? "color-mix(in srgb, var(--owe) 14%, var(--card))"
                          : "var(--chip)",
                  }}
                />
                <text
                  x={n.x}
                  y={by + 13}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="800"
                  style={{ fill: net > 0 ? "var(--green-soft-ink)" : net < 0 ? "var(--owe)" : "var(--muted)" }}
                >
                  {`${net > 0 ? "+" : net < 0 ? "−" : ""}${plain(Math.abs(net))}`}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function Workings({
  doc,
  payments,
  onDone,
}: {
  doc: BillDoc;
  payments: readonly Payment[];
  onDone: () => void;
}) {
  const { t, locale, money, plain } = useI18n();
  const h = t.how;
  const w = useMemo(() => workings(doc, payments), [doc, payments]);
  const [at, setAt] = useState(0);

  if (w.steps.length === 0) return <p className="m-0 px-1 text-[14px] text-muted">{h.empty}</p>;

  const total = w.steps.length + (w.paid.length ? 3 : 2);
  const step = Math.min(at, total - 1);
  const name = (id: string) => doc.people.find((p) => p.id === id)?.name ?? "?";
  const names = (ids: string[]) =>
    new Intl.ListFormat(intlLocale(locale), { type: "conjunction" }).format(ids.map(name));
  const short = (minor: number) => plain(minor).replace(/\.00$/, "");

  const net = Object.fromEntries(w.tally.map((x) => [x.id, x.net]));
  const seen = new Set([
    ...w.steps.flatMap((s) => s.changes.flatMap((c) => (c.kind === "cancel" ? [c.ower, c.owed] : [c.from, c.to]))),
    ...w.paid.flatMap((p) => [p.from, p.to]),
  ]);
  const verdict = (amount: number) =>
    amount > 0
      ? fmt(h.gets, { amount: money(amount) })
      : amount < 0
        ? fmt(h.pays, { amount: money(-amount) })
        : h.square;
  const tint = (amount: number) =>
    cn("font-extrabold", amount > 0 ? "text-green" : amount < 0 ? "text-owe" : "text-ink");
  const ids = doc.people.map((p) => p.id).filter((id) => seen.has(id));
  const top = ids.filter((id) => (net[id] ?? 0) >= 0);
  const bottom = ids.filter((id) => (net[id] ?? 0) < 0);

  const changeEdge = (c: Change): Edge => {
    if (c.kind === "new") return { from: c.from, to: c.to, label: short(c.amount), tone: "new" };
    if (c.kind === "more")
      return {
        from: c.from,
        to: c.to,
        label: `${short(c.before)} + ${short(c.added)} = ${short(c.amount)}`,
        tone: "new",
      };
    if (c.amount === 0)
      return { from: c.owed, to: c.ower, label: `${short(c.back)} − ${short(c.owes)} = 0`, tone: "gone" };
    const [big, small] = c.from === c.owed ? [c.back, c.owes] : [c.owes, c.back];
    return { from: c.from, to: c.to, label: `${short(big)} − ${short(small)} = ${short(c.amount)}`, tone: "new" };
  };

  const debtEdges = (debts: Debt[], tone: Tone, labels = true): Edge[] =>
    debts.map((d) => ({ from: d.from, to: d.to, label: labels ? short(d.amount) : "", tone }));

  let title: string;
  let edges: Edge[];
  let badges: Record<string, number> | undefined;
  let text: ReactNode;

  if (step < w.steps.length) {
    const s = w.steps[step];
    const changed = s.changes.map(changeEdge);
    const touched = new Set(changed.flatMap((e) => [`${e.from}>${e.to}`, `${e.to}>${e.from}`]));
    edges = [
      ...debtEdges(step > 0 ? w.steps[step - 1].debts : [], "old").filter((e) => !touched.has(`${e.from}>${e.to}`)),
      ...changed,
    ];
    title = fmt(h.paid, { name: name(s.item.paidBy), item: s.item.name, amount: money(s.item.amountMinor) });

    const values = Object.values(s.shares);
    const low = Math.min(...values);
    const extra = values.reduce((sum, v) => sum + v, 0) - low * values.length;
    const lines: string[] = [];
    if (Math.max(...values) - low <= 1) {
      lines.push(fmt(h.each, { count: values.length, amount: money(low) }));
      if (extra > 0)
        lines.push(fmt(h.sen, { sen: extra, names: names(Object.keys(s.shares).filter((id) => s.shares[id] > low)) }));
    } else lines.push(h.parts);
    const out = doc.people.filter((p) => !(p.id in s.shares)).map((p) => p.id);
    if (out.length) lines.push(fmt(h.notIn, { names: names(out) }));
    const fresh = s.changes.filter((c) => c.kind === "new");
    for (const amount of [...new Set(fresh.map((c) => c.amount))]) {
      const who = fresh.filter((c) => c.amount === amount).map((c) => c.from);
      lines.push(
        fmt(who.length > 1 ? h.owe : h.owes, { names: names(who), to: name(s.item.paidBy), amount: money(amount) }),
      );
    }
    for (const c of s.changes) {
      if (c.kind === "more")
        lines.push(
          fmt(h.more, { name: name(c.from), to: name(c.to), before: money(c.before), amount: money(c.amount) }),
        );
      if (c.kind === "cancel")
        lines.push(
          fmt(c.amount ? h.cancel : h.even, {
            ower: name(c.ower),
            owed: name(c.owed),
            owes: money(c.owes),
            back: money(c.back),
            from: name(c.from),
            to: name(c.to),
            amount: money(c.amount),
          }),
        );
    }
    text = lines.map((line) => (
      <p key={line} className="m-0">
        {line}
      </p>
    ));
  } else if (step === w.steps.length) {
    title = h.addUp;
    edges = debtEdges(w.debts, "faint", false);
    badges = net;
    text = (
      <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5">
        {w.tally.map((x) => {
          const [plus, minus] = x.net >= 0 ? [x.gets, x.pays] : [x.pays, x.gets];
          const sum = [plus.map(short).join(" + "), ...minus.map(short)].filter(Boolean).join(" − ");
          return [
            <span key={`${x.id}-n`} className="text-ink">
              {name(x.id)}
            </span>,
            <span key={`${x.id}-s`}>
              {plus.length + minus.length > 1 ? `${sum} = ` : ""}
              <b className={tint(x.net)}>{verdict(x.net)}</b>
            </span>,
          ];
        })}
      </div>
    );
  } else if (w.paid.length && step === w.steps.length + 1) {
    title = h.paidTitle;
    edges = w.paid.map((p) => ({ from: p.from, to: p.to, label: `${short(p.amount)} ✓`, tone: "new" }));
    badges = w.after;
    const moved = ids.filter((id) => w.paid.some((p) => p.from === id || p.to === id));
    text = (
      <>
        {w.paid.map((p, i) => (
          <p key={i} className="m-0">
            {fmt(h.paidLine, { from: name(p.from), to: name(p.to), amount: money(p.amount) })}
          </p>
        ))}
        <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 pt-1">
          {moved.map((id) => {
            const before = net[id] ?? 0;
            const sign = before >= 0 ? 1 : -1;
            const sum = [
              short(Math.abs(before)),
              ...w.paid.filter((p) => p.from === id).map((p) => `${sign > 0 ? "+" : "−"} ${short(p.amount)}`),
              ...w.paid.filter((p) => p.to === id).map((p) => `${sign > 0 ? "−" : "+"} ${short(p.amount)}`),
            ].join(" ");
            return [
              <span key={`${id}-n`} className="text-ink">
                {name(id)}
              </span>,
              <span key={`${id}-s`}>
                {`${sum} = `}
                <b className={tint(w.after[id] ?? 0)}>{verdict(w.after[id] ?? 0)}</b>
              </span>,
            ];
          })}
        </div>
      </>
    );
  } else {
    title = h.plan;
    edges = w.plan.map((l) => ({ from: l.from, to: l.to, label: short(l.amount), tone: "ink" }));
    badges = w.paid.length ? w.after : net;
    const count = (n: number) => (n === 1 ? h.one : fmt(h.many, { count: n }));
    const takers = [...new Set(w.plan.map((l) => l.to))];
    const lines = takers.map((id) => {
      const from = w.plan.filter((l) => l.to === id);
      return fmt(h.from, {
        name: name(id),
        amount: money(from.reduce((sum, l) => sum + l.amount, 0)),
        list: from.map((l) => `${name(l.from)} ${plain(l.amount)}`).join(" + "),
      });
    });
    if (w.plan.length === 0) lines.push(h.none);
    else if (w.paid.length) lines.push(fmt(h.left, { payments: count(w.plan.length) }));
    else
      lines.push(
        w.debts.length > w.plan.length
          ? fmt(h.fewer, { debts: w.debts.length, payments: count(w.plan.length) })
          : fmt(h.total, { payments: count(w.plan.length) }),
      );
    text = lines.map((line) => (
      <p key={line} className="m-0">
        {line}
      </p>
    ));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-[11.5px] font-extrabold tracking-[0.06em] text-faint uppercase">
          {fmt(h.step, { n: step + 1, total })}
        </span>
        <span aria-hidden className="flex gap-1">
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className={cn("h-1.5 rounded-full", i === step ? "w-[18px] bg-ink" : "w-1.5 bg-border")} />
          ))}
        </span>
      </div>
      <div key={step} className="flex animate-fade flex-col gap-1.5">
        <h3 className="m-0 px-1 text-[15.5px] font-extrabold text-ink">{title}</h3>
        <Flow doc={doc} top={top} bottom={bottom} edges={edges} badges={badges} />
        <div className="flex flex-col gap-1 px-1 text-[13px] leading-[1.55] font-semibold text-muted">{text}</div>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setAt(step - 1)}
          className="h-10 rounded-full bg-chip px-4 text-[14px] font-bold text-ink disabled:opacity-40"
        >
          ‹ {t.page.back}
        </button>
        <button
          type="button"
          onClick={() => (step === total - 1 ? onDone() : setAt(step + 1))}
          className="h-10 rounded-full bg-green px-5 text-[14px] font-extrabold text-white"
        >
          {step === total - 1 ? h.done : `${h.next} ›`}
        </button>
      </div>
    </div>
  );
}
