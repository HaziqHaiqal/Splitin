import { simplifyDebts, splitEqual, type Allocation, type Transfer } from "@/lib/money";

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
  participants: string[];
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

export type PersonSummary = {
  id: string;
  share: number;
  paid: number;
  net: number;
};

export type PlanLine = Transfer & { paymentId?: string; markedBy?: Payment["markedBy"]; paidAt?: string };

export type BillSummary = {
  total: number;
  people: PersonSummary[];
  sameShare: number | null;
  balances: Allocation;
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

export type SplitWords = { each: string; about: string; others: string; not: string };

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

export function evenShare(item: Item, peopleCount: number): { amount: number; exact: boolean } | null {
  if (item.participants.length !== peopleCount || Object.keys(item.overrides).length > 0) return null;
  const values = Object.values(itemShares(item));
  if (values.length === 0) return null;
  const exact = Math.max(...values) === Math.min(...values);
  return { amount: exact ? values[0] : Math.round(item.amountMinor / values.length), exact };
}
