import { describe, expect, it } from "vitest";
import type { BillDoc, Item } from "./bill";
import { diffDocs, memberWho, ownerWho } from "./history";

const everyone = ["h", "n"];
const water: Item = { id: "w", name: "Water", amountMinor: 5000, paidBy: "h", participants: everyone, overrides: {} };
const base: BillDoc = {
  title: "Trip",
  currency: "MYR",
  createdAt: "2026-10-31T01:00:00.000Z",
  people: [
    { id: "h", name: "Haziq", color: 0 },
    { id: "n", name: "Najmi", color: 1, bank: "Maybank", accountNo: "111" },
  ],
  items: [water],
};

describe("memberWho", () => {
  it("gives the ID and name of someone on the bill", () => {
    expect(memberWho(base, "n")).toEqual({ role: "member", personId: "n", name: "Najmi" });
  });

  it("gives only the role for anyone else", () => {
    for (const id of ["-", "Hacker", undefined, { id: "n" }]) expect(memberWho(base, id)).toEqual({ role: "member" });
  });

  it("does not let someone pose as the owner", () => {
    expect(memberWho({ ...base, ownerId: "h" }, "h")).toEqual({ role: "member" });
  });
});

describe("ownerWho", () => {
  it("names the owner", () => {
    expect(ownerWho({ ...base, ownerId: "n" })).toEqual({ role: "owner", personId: "n", name: "Najmi" });
  });

  it("gives only the role when the owner is not on the bill", () => {
    expect(ownerWho({ ...base, ownerId: null })).toEqual({ role: "owner" });
  });
});

describe("diffDocs", () => {
  it("reports nothing when nothing changed", () => {
    expect(diffDocs(base, structuredClone(base))).toEqual([]);
  });

  it("ignores member bookkeeping when the owner edits an item", () => {
    const before = { ...base, items: [{ ...water, addedAt: "2026-10-31T02:00:00.000Z" }] };
    expect(diffDocs(before, base)).toEqual([]);
  });

  it("ignores the order of split amounts", () => {
    const a = { ...base, items: [{ ...water, overrides: { h: 100, n: 200 } }] };
    const b = { ...base, items: [{ ...water, overrides: { n: 200, h: 100 } }] };
    expect(diffDocs(a, b)).toEqual([]);
  });

  it("reports added and deleted items", () => {
    const food: Item = { ...water, id: "f", name: "Food", amountMinor: 9000, paidBy: "n" };
    expect(diffDocs(base, { ...base, items: [water, food] })).toEqual([
      { kind: "item_added", name: "Food", amountMinor: 9000, payer: "Najmi" },
    ]);
    expect(diffDocs(base, { ...base, items: [] })).toEqual([
      { kind: "item_deleted", name: "Water", amountMinor: 5000 },
    ]);
  });

  it("reports exactly what changed on an item", () => {
    const edited: Item = { ...water, name: "Air", amountMinor: 6000, paidBy: "n", overrides: { h: 100 } };
    expect(diffDocs(base, { ...base, items: [edited] })).toEqual([
      {
        kind: "item_edited",
        name: "Air",
        changes: { name: ["Water", "Air"], amount: [5000, 6000], payer: ["Haziq", "Najmi"], split: true },
      },
    ]);
  });

  it("reports people changes and the bill title", () => {
    const after: BillDoc = {
      ...base,
      title: "Holiday",
      people: [
        { id: "h", name: "Haziq Haiqal", color: 0 },
        { id: "a", name: "Afiq", color: 2 },
      ],
    };
    expect(diffDocs(base, after)).toEqual([
      { kind: "title_changed", to: "Holiday" },
      { kind: "person_renamed", from: "Haziq", to: "Haziq Haiqal" },
      { kind: "person_added", name: "Afiq" },
      { kind: "person_removed", name: "Najmi" },
    ]);
  });

  it("never records bank account numbers", () => {
    const after: BillDoc = {
      ...base,
      people: [base.people[0], { ...base.people[1], accountNo: "9876543210" }],
    };
    const events = diffDocs(base, after);
    expect(events).toEqual([{ kind: "person_details", name: "Najmi" }]);
    expect(JSON.stringify(events)).not.toContain("9876543210");
  });
});
