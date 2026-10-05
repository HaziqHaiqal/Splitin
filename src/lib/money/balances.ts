import type { Allocation } from "./split";

export type LedgerExpense = {
  payers: { memberId: string; amountMinor: number }[];
  splits: { memberId: string; amountMinor: number }[];
};

export type LedgerSettlement = {
  fromMember: string;
  toMember: string;
  amountMinor: number;
};

export type Transfer = { from: string; to: string; amount: number };

/**
 * Net position per member: positive = is owed money, negative = owes money.
 * Always sums to zero when every expense's payers and splits sum to the same total.
 */
export function computeBalances(
  memberIds: readonly string[],
  expenses: readonly LedgerExpense[],
  settlements: readonly LedgerSettlement[] = [],
): Allocation {
  const balances: Allocation = {};
  for (const id of memberIds) balances[id] = 0;
  const add = (id: string, delta: number) => {
    balances[id] = (balances[id] ?? 0) + delta;
  };

  for (const expense of expenses) {
    for (const p of expense.payers) add(p.memberId, p.amountMinor);
    for (const s of expense.splits) add(s.memberId, -s.amountMinor);
  }
  for (const s of settlements) {
    add(s.fromMember, s.amountMinor);
    add(s.toMember, -s.amountMinor);
  }
  return balances;
}

/**
 * Greedy settle-up: repeatedly match the largest creditor with the largest debtor.
 * Produces at most n − 1 transfers and is deterministic for equal balances.
 */
export function simplifyDebts(balances: Readonly<Allocation>): Transfer[] {
  const order = Object.keys(balances);
  const rank = (id: string) => order.indexOf(id);
  const creditors = order
    .filter((id) => balances[id] > 0)
    .map((id) => ({ id, amount: balances[id] }));
  const debtors = order
    .filter((id) => balances[id] < 0)
    .map((id) => ({ id, amount: -balances[id] }));

  const byAmount = (a: { id: string; amount: number }, b: { id: string; amount: number }) =>
    b.amount - a.amount || rank(a.id) - rank(b.id);

  const transfers: Transfer[] = [];
  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort(byAmount);
    debtors.sort(byAmount);
    const creditor = creditors[0];
    const debtor = debtors[0];
    const amount = Math.min(creditor.amount, debtor.amount);
    transfers.push({ from: debtor.id, to: creditor.id, amount });
    creditor.amount -= amount;
    debtor.amount -= amount;
    if (creditor.amount === 0) creditors.shift();
    if (debtor.amount === 0) debtors.shift();
  }
  return transfers;
}
