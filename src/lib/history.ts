import { ownerOf, type BillDoc, type Item } from "./bill";

export type ItemChanges = {
  name?: [string, string];
  amount?: [number, number];
  payer?: [string, string];
  split?: boolean;
};

export type EventBody =
  | { kind: "created" }
  | { kind: "item_added"; name: string; amountMinor: number; payer: string }
  | { kind: "item_deleted"; name: string; amountMinor: number }
  | { kind: "item_edited"; name: string; changes: ItemChanges }
  | { kind: "title_changed"; to: string }
  | { kind: "person_added"; name: string }
  | { kind: "person_removed"; name: string }
  | { kind: "person_renamed"; from: string; to: string }
  | { kind: "person_details"; name: string }
  | { kind: "person_joined"; name: string }
  | { kind: "bill_joined"; name: string; amountMinor: number }
  | { kind: "bill_left"; name: string }
  | { kind: "share_changed"; name: string; from: number; to: number }
  | { kind: "locked" }
  | { kind: "unlocked" }
  | { kind: "paid"; from: string; to: string; amountMinor: number; paymentId?: string }
  | { kind: "unpaid"; from: string; to: string; amountMinor: number };

export type ByRole = "owner" | "member";

export type Who = { role: ByRole; personId?: string; name?: string };

export type BillEvent = EventBody & {
  id: string;
  byRole: ByRole;
  byPersonId?: string;
  byName?: string;
  createdAt: string;
};

export const personName = (doc: BillDoc, id: string) => doc.people.find((p) => p.id === id)?.name ?? "?";

export const memberWho = (doc: BillDoc, id: unknown): Who => {
  const person = id === doc.ownerId ? undefined : doc.people.find((p) => p.id === id);
  return { role: "member", personId: person?.id, name: person?.name };
};

export const ownerWho = (doc: BillDoc): Who => {
  const person = ownerOf(doc);
  return { role: "owner", personId: person?.id, name: person?.name };
};

const splitKey = (item: Item) =>
  JSON.stringify([
    [...item.participants].sort(),
    Object.entries(item.overrides).sort(([a], [b]) => a.localeCompare(b)),
  ]);

export function diffDocs(before: BillDoc, after: BillDoc): EventBody[] {
  const events: EventBody[] = [];
  if (before.title !== after.title) events.push({ kind: "title_changed", to: after.title });

  for (const person of after.people) {
    const old = before.people.find((p) => p.id === person.id);
    if (!old) {
      events.push({ kind: "person_added", name: person.name });
      continue;
    }
    if (old.name !== person.name) events.push({ kind: "person_renamed", from: old.name, to: person.name });
    if ((old.bank ?? "") !== (person.bank ?? "") || (old.accountNo ?? "") !== (person.accountNo ?? ""))
      events.push({ kind: "person_details", name: person.name });
  }
  for (const old of before.people) {
    if (!after.people.some((p) => p.id === old.id)) events.push({ kind: "person_removed", name: old.name });
  }

  for (const item of after.items) {
    const old = before.items.find((i) => i.id === item.id);
    if (!old) {
      events.push({
        kind: "item_added",
        name: item.name,
        amountMinor: item.amountMinor,
        payer: personName(after, item.paidBy),
      });
      continue;
    }
    const changes: ItemChanges = {};
    if (old.name !== item.name) changes.name = [old.name, item.name];
    if (old.amountMinor !== item.amountMinor) changes.amount = [old.amountMinor, item.amountMinor];
    if (old.paidBy !== item.paidBy) changes.payer = [personName(before, old.paidBy), personName(after, item.paidBy)];
    if (splitKey(old) !== splitKey(item)) changes.split = true;
    if (Object.keys(changes).length > 0) events.push({ kind: "item_edited", name: item.name, changes });
  }
  for (const old of before.items) {
    if (!after.items.some((i) => i.id === old.id))
      events.push({ kind: "item_deleted", name: old.name, amountMinor: old.amountMinor });
  }
  return events;
}
