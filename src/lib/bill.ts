import { simplifyDebts, splitEqual, type Allocation, type Transfer } from "@/lib/money";

/* ───────────── shapes stored in the shared bill (jsonb) ───────────── */

export type Person = {
  id: string;
  name: string;
  color: number;
  bank?: string | null;
  accountNo?: string | null;
};

export type Item = {
  id: string;
  name: string;
  amountMinor: number;
  paidBy: string;
  /** people sharing this bill */
  participants: string[];
  /** amounts someone typed by hand; everyone else splits the rest equally */
  overrides: Record<string, number>;
};

export type BillDoc = {
  title: string;
  currency: "MYR";
  createdAt: string;
  people: Person[];
  items: Item[];
};

export type Payment = {
  id: string;
  from: string;
  to: string;
  amountMinor: number;
  markedBy: "payer" | "owner";
  createdAt: string;
};

/* ───────────── per-bill split ───────────── */

export type ItemSplit =
  { ok: true; shares: Allocation } | { ok: false; error: "empty" | "over" | "under"; diff: number };

export function splitItem(
  amountMinor: number,
  participants: readonly string[],
  overrides: Readonly<Record<string, number>>,
): ItemSplit {
  if (participants.length === 0) return { ok: false, error: "empty", diff: 0 };
  const fixed: Allocation = {};
  for (const id of participants) if (overrides[id] !== undefined) fixed[id] = overrides[id];
  const fixedSum = Object.values(fixed).reduce((s, v) => s + v, 0);
  if (fixedSum > amountMinor) return { ok: false, error: "over", diff: fixedSum - amountMinor };

  const free = participants.filter((id) => fixed[id] === undefined);
  const rest = amountMinor - fixedSum;
  if (free.length === 0) {
    return rest === 0 ? { ok: true, shares: fixed } : { ok: false, error: "under", diff: rest };
  }
  return { ok: true, shares: { ...fixed, ...splitEqual(rest, free) } };
}

export function itemShares(item: Item): Allocation {
  const result = splitItem(item.amountMinor, item.participants, item.overrides);
  return result.ok ? result.shares : {};
}

/* ───────────── whole-bill summary ───────────── */

export type PersonSummary = {
  id: string;
  share: number;
  paid: number;
  /** paid − share, before any payments are marked */
  net: number;
};

export type PlanLine = Transfer & { paymentId?: string; markedBy?: Payment["markedBy"]; paidAt?: string };

export type BillSummary = {
  total: number;
  people: PersonSummary[];
  /** everyone owes the same share */
  sameShare: number | null;
  /** balances after marked payments */
  balances: Allocation;
  /** payments already marked, then what is still to pay */
  done: PlanLine[];
  remaining: PlanLine[];
};

export function summarize(doc: BillDoc, payments: readonly Payment[] = []): BillSummary {
  const ids = doc.people.map((p) => p.id);
  const share: Allocation = Object.fromEntries(ids.map((id) => [id, 0]));
  const paid: Allocation = Object.fromEntries(ids.map((id) => [id, 0]));
  let total = 0;

  for (const item of doc.items) {
    total += item.amountMinor;
    paid[item.paidBy] = (paid[item.paidBy] ?? 0) + item.amountMinor;
    for (const [id, amount] of Object.entries(itemShares(item))) share[id] = (share[id] ?? 0) + amount;
  }

  const people = ids.map((id) => ({ id, share: share[id], paid: paid[id], net: paid[id] - share[id] }));
  const shares = people.map((p) => p.share);
  const sameShare = shares.length > 0 && shares.every((s) => s === shares[0]) ? shares[0] : null;

  const balances: Allocation = Object.fromEntries(people.map((p) => [p.id, p.net]));
  for (const p of payments) {
    if (!(p.from in balances) || !(p.to in balances)) continue;
    balances[p.from] += p.amountMinor;
    balances[p.to] -= p.amountMinor;
  }

  return {
    total,
    people,
    sameShare,
    balances,
    done: payments
      .filter((p) => p.from in balances && p.to in balances)
      .map((p) => ({
        from: p.from,
        to: p.to,
        amount: p.amountMinor,
        paymentId: p.id,
        markedBy: p.markedBy,
        paidAt: p.createdAt,
      })),
    remaining: simplifyDebts(balances).sort(
      (x, y) => ids.indexOf(x.from) - ids.indexOf(y.from) || ids.indexOf(x.to) - ids.indexOf(y.to),
    ),
  };
}

/* ───────────── receipt helpers ───────────── */

export type SplitWords = { each: string; about: string; others: string; not: string };

/**
 * How one bill is split, in a few plain words for the receipt:
 * "25.00 EACH", "ABOUT 33.33 EACH" (a sen left over), "HAZIQ 40.00 · OTHERS ABOUT 26.67 EACH",
 * "30.00 EACH · NOT IMANUL". Amounts within 1 sen of each other count as the same share.
 */
export function itemSplitText(
  item: Item,
  people: readonly Person[],
  format: (minor: number) => string,
  words: SplitWords,
): string {
  const shares = itemShares(item);
  const included = people.filter((p) => item.participants.includes(p.id));
  const excluded = people.filter((p) => !item.participants.includes(p.id));
  const value = (p: Person) => shares[p.id] ?? 0;

  // the share most people pay (needs at least two people to count as "each")
  let common: number | null = null;
  let best = 1;
  for (const p of included) {
    const near = included.filter((q) => Math.abs(value(q) - value(p)) <= 1).length;
    if (near > best) {
      best = near;
      common = value(p);
    }
  }
  const inGroup = (p: Person) => common !== null && Math.abs(value(p) - common) <= 1;
  const group = included.filter(inGroup);
  const others = included.filter((p) => !inGroup(p));

  const parts = others.map((p) => `${p.name.toUpperCase()} ${format(value(p))}`);
  if (group.length > 0) {
    const sum = group.reduce((s, p) => s + value(p), 0);
    const exact = group.every((p) => value(p) === value(group[0]));
    const amount = exact ? value(group[0]) : Math.round(sum / group.length);
    parts.push(
      `${others.length > 0 ? `${words.others} ` : ""}${exact ? "" : `${words.about} `}${format(amount)} ${words.each}`,
    );
  }
  if (excluded.length > 0) parts.push(`${words.not} ${excluded.map((p) => p.name.toUpperCase()).join(", ")}`);
  return parts.join(" · ");
}

/**
 * What each person pays when a bill is shared equally by everyone, or null when it isn't
 * (someone is left out or has a typed amount). `exact` is false when the amount doesn't divide
 * evenly, so some people pay one sen more than others: RM240.90 / 4 = 60.23, 60.23, 60.22, 60.22.
 */
export function evenShare(item: Item, peopleCount: number): { amount: number; exact: boolean } | null {
  if (item.participants.length !== peopleCount || Object.keys(item.overrides).length > 0) return null;
  const values = Object.values(itemShares(item));
  if (values.length === 0) return null;
  const exact = Math.max(...values) === Math.min(...values);
  return { amount: exact ? values[0] : Math.round(item.amountMinor / values.length), exact };
}
