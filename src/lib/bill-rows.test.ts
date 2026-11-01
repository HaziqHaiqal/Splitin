import { describe, expect, it } from "vitest";
import type { BillDoc } from "./bill";
import { docFromRow, eventRows, rightsFromRow, saveArgs, type BillRow } from "./bill-rows";

const doc: BillDoc = {
  title: "Trip",
  currency: "MYR",
  createdAt: "2026-10-31T01:00:00.000Z",
  ownerId: "h",
  people: [
    { id: "h", name: "Haziq", color: 0 },
    { id: "n", name: "Najmi", color: 1, bank: "Maybank", accountNo: "123", addedAt: "2026-10-31T02:00:00.000Z" },
  ],
  items: [
    {
      id: "hotel",
      name: "Hotel",
      amountMinor: 1001,
      paidBy: "h",
      participants: ["n", "h"],
      overrides: { n: 500 },
      addedAt: "2026-10-31T02:30:00.000Z",
      joins: { n: { at: "2026-10-31T03:00:00.000Z" } },
    },
  ],
};
const rights = { people: { n: "p-hash" }, items: { hotel: "i-hash" }, joins: { hotel: { n: "j-hash" } } };

function rowOf(source: BillDoc): BillRow {
  const { p_bill, p_people, p_items, p_shares } = saveArgs(source, rights);
  return {
    id: "TE5TB4RS",
    title: p_bill.title,
    currency: "MYR",
    owner_person_id: p_bill.owner_person_id,
    owner_token_hash: "o-hash",
    browser_hash: null,
    locked: p_bill.locked,
    version: 1,
    started_at: source.createdAt.replace("Z", "+00:00"),
    created_at: source.createdAt,
    expires_at: source.createdAt,
    bill_people: p_people,
    bill_items: p_items.map((i) => ({ ...i, item_shares: p_shares.filter((s) => s.item_id === i.id) })),
    payments: [],
  };
}

describe("bill rows", () => {
  it("gives the same bill back", () => {
    expect(docFromRow(rowOf(doc))).toEqual({ ...doc, locked: undefined });
  });

  it("keeps the order of people on an item, so the extra sen stays with the same person", () => {
    expect(docFromRow(rowOf(doc)).items[0].participants).toEqual(["n", "h"]);
  });

  it("writes each person once on an item", () => {
    const repeated = { ...doc, items: [{ ...doc.items[0], participants: ["n", "h", "n"] }] };
    expect(saveArgs(repeated, {}).p_shares.map((s) => s.person_id)).toEqual(["n", "h"]);
  });

  it("gives the same rights back", () => {
    expect(rightsFromRow(rowOf(doc))).toEqual({ ...rights, payments: {} });
  });

  it("drops rights for things no longer on the bill", () => {
    const smaller = { ...doc, items: [] };
    expect(saveArgs(smaller, rights).p_items).toEqual([]);
    expect(saveArgs({ ...doc, people: [doc.people[0]] }, rights).p_people[0].browser_hash).toBeNull();
  });

  it("turns a change into a row with the rest kept as data", () => {
    const who = { role: "member" as const, personId: "n", name: "Najmi" };
    expect(eventRows(who, [{ kind: "item_deleted", name: "Hotel", amountMinor: 100 }])).toEqual([
      {
        kind: "item_deleted",
        by_role: "member",
        by_person_id: "n",
        by_name: "Najmi",
        data: { name: "Hotel", amountMinor: 100 },
      },
    ]);
  });
});
