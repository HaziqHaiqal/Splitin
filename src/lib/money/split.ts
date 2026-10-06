// All amounts are integers in the currency's minor unit (sen for MYR).
// Every function here returns allocations that sum *exactly* to the total.

export type Allocation = Record<string, number>;

function assertInt(n: number, label: string) {
  if (!Number.isSafeInteger(n)) throw new Error(`${label} must be an integer, got ${n}`);
}

/** Split `total` evenly; leftover minor units go one-by-one in `ids` order. */
export function splitEqual(total: number, ids: readonly string[]): Allocation {
  assertInt(total, "total");
  if (ids.length === 0) throw new Error("splitEqual needs at least one participant");
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const base = Math.floor(abs / ids.length);
  let remainder = abs - base * ids.length;
  const out: Allocation = {};
  for (const id of ids) {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    out[id] = (out[id] ?? 0) + sign * (base + extra);
  }
  return out;
}

/**
 * Split `total` proportionally to `weights` using the largest-remainder method.
 * Ties are broken by key order so results are deterministic.
 */
export function splitByWeights(total: number, weights: Readonly<Record<string, number>>): Allocation {
  assertInt(total, "total");
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const weightSum = entries.reduce((s, [, w]) => s + w, 0);
  if (entries.length === 0 || weightSum <= 0) throw new Error("splitByWeights needs a positive weight");
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);

  const rows = entries.map(([id, w], index) => {
    const exact = (abs * w) / weightSum;
    const floor = Math.floor(exact);
    return { id, floor, frac: exact - floor, index };
  });
  let remainder = abs - rows.reduce((s, r) => s + r.floor, 0);
  const byFrac = [...rows].sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (const row of byFrac) {
    if (remainder <= 0) break;
    row.floor += 1;
    remainder -= 1;
  }

  const out: Allocation = {};
  for (const id of Object.keys(weights)) out[id] = 0;
  for (const row of rows) out[row.id] = sign * row.floor;
  return out;
}

export type Item = {
  name: string;
  unitPriceMinor: number;
  qty: number;
  assignees: string[];
};

export type Extras = {
  /** e.g. 10 for a 10% service charge */
  servicePct?: number | null;
  /** e.g. 6 for 6% SST, applied on subtotal + service charge */
  taxPct?: number | null;
  discountMinor?: number | null;
  /** The printed total on the receipt; any difference is spread proportionally. */
  receiptTotalMinor?: number | null;
};

export type ItemizedResult = {
  subtotal: number;
  unassigned: number;
  service: number;
  tax: number;
  discount: number;
  /** receiptTotal − computed total (rounding adjustments etc.) */
  adjustment: number;
  total: number;
  /** each person's item subtotal before extras */
  subtotals: Allocation;
  /** each person's final share, sums exactly to `total` */
  shares: Allocation;
};

export function computeItemized(items: readonly Item[], extras: Extras = {}): ItemizedResult {
  const subtotals: Allocation = {};
  let unassigned = 0;
  for (const item of items) {
    assertInt(item.unitPriceMinor, "unitPriceMinor");
    const line = item.unitPriceMinor * item.qty;
    assertInt(line, "line total");
    if (item.assignees.length === 0) {
      unassigned += line;
      continue;
    }
    for (const [id, amount] of Object.entries(splitEqual(line, item.assignees))) {
      subtotals[id] = (subtotals[id] ?? 0) + amount;
    }
  }

  const subtotal = Object.values(subtotals).reduce((s, v) => s + v, 0);
  const service = Math.round((subtotal * (extras.servicePct ?? 0)) / 100);
  const tax = Math.round(((subtotal + service) * (extras.taxPct ?? 0)) / 100);
  const discount = extras.discountMinor ?? 0;
  const computed = subtotal + service + tax - discount;
  const total = extras.receiptTotalMinor ?? computed;

  const hasWeights = Object.values(subtotals).some((v) => v > 0);
  const shares = hasWeights && total !== 0 ? splitByWeights(total, subtotals) : mapValues(subtotals, () => 0);

  return {
    subtotal,
    unassigned,
    service,
    tax,
    discount,
    adjustment: total - computed,
    total,
    subtotals,
    shares,
  };
}

export type SplitMode = "equal" | "exact" | "shares" | "itemized";

export type SplitInput =
  | { mode: "equal"; total: number; participants: string[] }
  | { mode: "exact"; total: number; amounts: Record<string, number> }
  | { mode: "shares"; total: number; shares: Record<string, number> }
  | { mode: "itemized"; items: Item[]; extras: Extras };

export type SplitResult =
  { ok: true; total: number; splits: Allocation } | { ok: false; error: SplitError; diff?: number };

export type SplitError =
  | "no_participants"
  | "amount_required"
  | "exact_mismatch"
  | "no_shares"
  | "no_items"
  | "unassigned_items"
  | "nothing_to_split";

/** Single entry point used by both the client preview and the server action. */
export function computeSplit(input: SplitInput): SplitResult {
  switch (input.mode) {
    case "equal": {
      if (input.total <= 0) return { ok: false, error: "amount_required" };
      if (input.participants.length === 0) return { ok: false, error: "no_participants" };
      return { ok: true, total: input.total, splits: splitEqual(input.total, input.participants) };
    }
    case "exact": {
      const splits = pickPositive(input.amounts);
      const sum = Object.values(splits).reduce((s, v) => s + v, 0);
      if (sum <= 0) return { ok: false, error: "amount_required" };
      if (input.total > 0 && sum !== input.total) {
        return { ok: false, error: "exact_mismatch", diff: input.total - sum };
      }
      return { ok: true, total: sum, splits };
    }
    case "shares": {
      if (input.total <= 0) return { ok: false, error: "amount_required" };
      const shares = pickPositive(input.shares);
      if (Object.keys(shares).length === 0) return { ok: false, error: "no_shares" };
      return { ok: true, total: input.total, splits: splitByWeights(input.total, shares) };
    }
    case "itemized": {
      if (input.items.length === 0) return { ok: false, error: "no_items" };
      const result = computeItemized(input.items, input.extras);
      if (result.unassigned > 0) return { ok: false, error: "unassigned_items", diff: result.unassigned };
      if (result.total <= 0 || result.subtotal <= 0) return { ok: false, error: "nothing_to_split" };
      return { ok: true, total: result.total, splits: pickPositive(result.shares) };
    }
  }
}

function pickPositive(record: Record<string, number>): Allocation {
  const out: Allocation = {};
  for (const [id, v] of Object.entries(record)) if (v > 0) out[id] = v;
  return out;
}

function mapValues(record: Allocation, fn: (v: number) => number): Allocation {
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, fn(v)]));
}
