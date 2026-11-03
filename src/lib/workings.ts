import { itemShares, summarize, type BillDoc, type Item, type PlanLine } from "./bill";

export type Debt = { from: string; to: string; amount: number };

export type Change =
  | { kind: "new"; from: string; to: string; amount: number }
  | { kind: "more"; from: string; to: string; before: number; added: number; amount: number }
  | {
      kind: "cancel";
      ower: string;
      owed: string;
      owes: number;
      back: number;
      from: string;
      to: string;
      amount: number;
    };

export type ItemStep = { item: Item; shares: Record<string, number>; changes: Change[]; debts: Debt[] };

export type Tally = { id: string; gets: number[]; pays: number[]; net: number };

export type Workings = { steps: ItemStep[]; debts: Debt[]; tally: Tally[]; plan: PlanLine[] };

const key = (from: string, to: string) => `${from}>${to}`;

const list = (owed: Map<string, number>): Debt[] =>
  [...owed].map(([k, amount]) => {
    const [from, to] = k.split(">");
    return { from, to, amount };
  });

export function workings(doc: BillDoc): Workings {
  const owed = new Map<string, number>();
  const steps: ItemStep[] = [];

  for (const item of doc.items) {
    const shares = itemShares(item);
    const payer = item.paidBy;
    const changes: Change[] = [];
    for (const [id, owes] of Object.entries(shares)) {
      if (id === payer || owes <= 0) continue;
      const before = owed.get(key(id, payer)) ?? 0;
      const back = owed.get(key(payer, id)) ?? 0;
      if (back === 0) {
        owed.set(key(id, payer), before + owes);
        changes.push(
          before === 0
            ? { kind: "new", from: id, to: payer, amount: owes }
            : { kind: "more", from: id, to: payer, before, added: owes, amount: before + owes },
        );
        continue;
      }
      owed.delete(key(payer, id));
      const [from, to] = back >= owes ? [payer, id] : [id, payer];
      const amount = Math.abs(back - owes);
      if (amount > 0) owed.set(key(from, to), amount);
      changes.push({ kind: "cancel", ower: id, owed: payer, owes, back, from, to, amount });
    }
    steps.push({ item, shares, changes, debts: list(owed) });
  }

  const debts = list(owed);
  const ids = doc.people.map((p) => p.id).filter((id) => debts.some((d) => d.from === id || d.to === id));
  const tally = ids.map((id) => {
    const gets = debts.filter((d) => d.to === id).map((d) => d.amount);
    const pays = debts.filter((d) => d.from === id).map((d) => d.amount);
    const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
    return { id, gets, pays, net: sum(gets) - sum(pays) };
  });

  return { steps, debts, tally, plan: summarize(doc).remaining };
}
