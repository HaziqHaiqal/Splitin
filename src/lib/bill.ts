import { simplifyDebts, splitEqual, type Allocation, type Transfer } from "@/lib/money";

export type Person = {
  id: string;
  name: string;
  color: number;
  bank?: string | null;
  accountNo?: string | null;
  addedAt?: string;
  keyHash?: string;
  detailsAt?: string;
};

export type Join = { hash: string; at: string };

export type Item = {
  id: string;
  name: string;
  amountMinor: number;
  paidBy: string;
  participants: string[];
  overrides: Record<string, number>;
  addedAt?: string;
  deleteHash?: string;
  joins?: Record<string, Join>;
};

export type PreviewItem = Item & { newPeople?: Person[] };

export type BillDoc = {
  title: string;
  currency: "MYR";
  createdAt: string;
  people: Person[];
  items: Item[];
  ownerId?: string | null;
  locked?: boolean;
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

export function ownerOf(doc: BillDoc): Person | undefined {
  return doc.ownerId === undefined ? doc.people[0] : doc.people.find((p) => p.id === doc.ownerId);
}

export function activePeople(doc: BillDoc): Person[] {
  if (doc.items.length === 0) return doc.people;
  return doc.people.filter((p) => doc.items.some((i) => i.paidBy === p.id || i.participants.includes(p.id)));
}

export function latestFriendChange(doc: BillDoc, after = ""): string {
  const times = [
    ...doc.people.flatMap((p) => [p.addedAt, p.detailsAt]),
    ...doc.items.flatMap((i) => [i.addedAt, ...Object.values(i.joins ?? {}).map((j) => j.at)]),
  ];
  return times.reduce<string>((latest, at) => (at && at > latest ? at : latest), after);
}

function without<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

function withJoins(item: Item, joins: Record<string, Join>): Item {
  const next = { ...item };
  delete next.joins;
  return Object.keys(joins).length > 0 ? { ...next, joins } : next;
}

function mergeJoins(server: Item | undefined, local: Item, seenAt: string, people: Set<string>): Item {
  if (!server || (!server.joins && !local.joins)) return local;
  const joins = { ...local.joins };
  const overrides = { ...local.overrides };
  let participants = local.participants;

  for (const id of Object.keys(joins)) {
    if (server.joins?.[id]) continue;
    delete joins[id];
    delete overrides[id];
    participants = participants.filter((p) => p !== id);
  }
  for (const [id, join] of Object.entries(server.joins ?? {})) {
    if (join.at <= seenAt || !people.has(id) || joins[id]?.at === join.at) continue;
    joins[id] = join;
    if (!participants.includes(id)) participants = [...participants, id];
    const written = server.overrides[id];
    if (written === undefined || !splitItem(local.amountMinor, participants, { ...overrides, [id]: written }).ok)
      delete overrides[id];
    else overrides[id] = written;
  }
  if (!splitItem(local.amountMinor, participants, overrides).ok) return local;
  return withJoins({ ...local, participants, overrides }, joins);
}

export function mergeFriendChanges(server: BillDoc, local: BillDoc, seenAt: string): BillDoc {
  const serverPeople = new Map(server.people.map((p) => [p.id, p]));
  const localPeople = new Set(local.people.map((p) => p.id));
  const people = [
    ...local.people
      .filter((p) => !p.addedAt || serverPeople.has(p.id))
      .map((p) => {
        const current = serverPeople.get(p.id);
        return current?.detailsAt && current.detailsAt > seenAt
          ? { ...p, bank: current.bank, accountNo: current.accountNo, detailsAt: current.detailsAt }
          : p;
      }),
    ...server.people.filter((p) => p.addedAt && p.addedAt > seenAt && !localPeople.has(p.id)),
  ];
  const known = new Set(people.map((p) => p.id));

  const serverItems = new Map(server.items.map((i) => [i.id, i]));
  const localItems = new Set(local.items.map((i) => i.id));
  const kept = local.items
    .filter((i) => !i.addedAt || serverItems.has(i.id))
    .map((i) => mergeJoins(serverItems.get(i.id), i, seenAt, known));
  const fresh = server.items.filter(
    (i) =>
      i.addedAt &&
      i.addedAt > seenAt &&
      !localItems.has(i.id) &&
      known.has(i.paidBy) &&
      i.participants.every((id) => known.has(id)),
  );

  const merged: BillDoc = { ...local, people, items: [...kept, ...fresh] };
  delete merged.locked;
  return server.locked ? { ...merged, locked: true } : merged;
}

export function withNewPeople(
  doc: BillDoc,
  added: readonly { id: string; name: string }[],
  keyHash: string,
  at: string,
): BillDoc | null {
  const names = new Set(doc.people.map((p) => p.name.toLowerCase()));
  const ids = new Set(doc.people.map((p) => p.id));
  let color = doc.people.reduce((max, p) => Math.max(max, p.color + 1), 0);
  const people = [...doc.people];
  for (const { id, name } of added) {
    if (names.has(name.toLowerCase()) || ids.has(id)) return null;
    names.add(name.toLowerCase());
    ids.add(id);
    people.push({ id, name, color: color++ % 100, addedAt: at, keyHash });
  }
  return { ...doc, people };
}

export function withoutPerson(doc: BillDoc, id: string): BillDoc {
  const items = doc.items
    .map((item) => {
      const overrides = without(item.overrides, id);
      const participants = item.participants.filter((p) => p !== id);
      const fits = splitItem(item.amountMinor, participants, overrides).ok;
      return withJoins({ ...item, participants, overrides: fits ? overrides : {} }, without(item.joins ?? {}, id));
    })
    .filter((item) => item.participants.length > 0);
  return {
    ...doc,
    ...(doc.ownerId === id ? { ownerId: null } : {}),
    people: doc.people.filter((p) => p.id !== id),
    items,
  };
}

export function joinShare(item: Item, personId: string, written?: number): number | null {
  const participants = item.participants.includes(personId) ? item.participants : [...item.participants, personId];
  const others = without(item.overrides, personId);
  const split = splitItem(
    item.amountMinor,
    participants,
    written === undefined ? others : { ...others, [personId]: written },
  );
  const share = split.ok ? (split.shares[personId] ?? 0) : 0;
  return share > 0 ? share : null;
}

export function joinItem(item: Item, personId: string, written: number | undefined, join: Join): Item | null {
  if (joinShare(item, personId, written) === null) return null;
  const others = without(item.overrides, personId);
  return {
    ...item,
    participants: item.participants.includes(personId) ? item.participants : [...item.participants, personId],
    overrides: written === undefined ? others : { ...others, [personId]: written },
    joins: { ...item.joins, [personId]: join },
  };
}

export function leaveItem(item: Item, personId: string): Item | null {
  const participants = item.participants.filter((p) => p !== personId);
  const overrides = without(item.overrides, personId);
  if (participants.length === 0 || !splitItem(item.amountMinor, participants, overrides).ok) return null;
  return withJoins({ ...item, participants, overrides }, without(item.joins ?? {}, personId));
}

export const joinerOf = (item: Item, hash: string) =>
  Object.entries(item.joins ?? {}).find(([, join]) => join.hash === hash)?.[0];

export function withoutOwnItem(doc: BillDoc, itemId: string, tokenHash: string): BillDoc | null {
  const item = doc.items.find((i) => i.id === itemId);
  if (!item?.deleteHash || item.deleteHash !== tokenHash) return null;
  return { ...doc, items: doc.items.filter((i) => i.id !== itemId) };
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
  const active = new Set(activePeople(doc).map((p) => p.id));
  const shares = people.filter((p) => active.has(p.id)).map((p) => p.share);
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
