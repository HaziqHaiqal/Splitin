import { describe, expect, it } from "vitest";
import {
  evenShare,
  itemSplitText,
  latestMemberChange,
  liveRights,
  mineOf,
  mergeMemberChanges,
  repeatedName,
  splitItem,
  summarize,
  withoutOwnItem,
  type BillDoc,
  type BillRights,
  type Item,
} from "./bill";
import { formatMoney } from "./money";

const people = [
  { id: "h", name: "Haziq", color: 0 },
  { id: "n", name: "Najmi", color: 1 },
  { id: "a", name: "Afiq", color: 2 },
  { id: "i", name: "Imanul", color: 3 },
];
const all = people.map((p) => p.id);

const houseBills: BillDoc = {
  title: "House bills · October",
  currency: "MYR",
  createdAt: "2026-10-05T13:40:00Z",
  people,
  items: [
    { id: "1", name: "Bill api", amountMinor: 20160, paidBy: "a", participants: all, overrides: {} },
    { id: "2", name: "Indah Water", amountMinor: 18000, paidBy: "h", participants: all, overrides: {} },
    { id: "3", name: "Wifi", amountMinor: 9220, paidBy: "h", participants: all, overrides: {} },
  ],
};

describe("withoutOwnItem", () => {
  const mine: Item = { ...houseBills.items[0], id: "mine" };
  const other: Item = { ...houseBills.items[0], id: "other" };
  const doc: BillDoc = { ...houseBills, items: [...houseBills.items, mine, other] };
  const rights: BillRights = { items: { mine: "my-hash", other: "other-hash" } };

  it("lets a member delete their own item", () => {
    expect(withoutOwnItem(doc, rights, "mine", "my-hash")?.items.map((i) => i.id)).toEqual(["1", "2", "3", "other"]);
  });

  it("refuses another member's item", () => {
    expect(withoutOwnItem(doc, rights, "other", "my-hash")).toBeNull();
  });

  it("refuses the owner's item, even with an empty key", () => {
    expect(withoutOwnItem(doc, rights, "1", "my-hash")).toBeNull();
    expect(withoutOwnItem(doc, rights, "1", "")).toBeNull();
  });

  it("refuses an item that does not exist", () => {
    expect(withoutOwnItem(doc, rights, "nope", "my-hash")).toBeNull();
  });
});

describe("liveRights", () => {
  const at = "2026-10-31T10:00:00.000Z";
  const added: Item = { ...houseBills.items[0], id: "added", addedAt: at, joins: { n: { at } } };
  const doc: BillDoc = { ...houseBills, items: [...houseBills.items, added] };
  const rights: BillRights = {
    people: { n: "person", gone: "person" },
    items: { added: "item", 1: "item", gone: "item" },
    joins: { added: { n: "join", a: "join" }, 1: { n: "join" }, gone: { n: "join" } },
  };

  it("keeps only keys that still do something", () => {
    expect(liveRights(doc, rights)).toEqual({
      people: { n: "person" },
      items: { added: "item" },
      joins: { added: { n: "join" } },
      payments: {},
    });
  });

  it("drops the delete key once the owner has edited the item", () => {
    const edited = { ...added, addedAt: undefined };
    const after = liveRights({ ...doc, items: [...houseBills.items, edited] }, rights);
    expect(after.items).toEqual({});
    expect(after.joins).toEqual({ added: { n: "join" } });
  });

  it("works on a bill with no keys yet", () => {
    expect(liveRights(doc, {})).toEqual({ people: {}, items: {}, joins: {}, payments: {} });
  });
});

describe("repeatedName", () => {
  const named = (...names: string[]): BillDoc => ({
    ...houseBills,
    people: names.map((name, i) => ({ id: String(i), name, color: i })),
  });

  it("is nothing when every name is different", () => {
    expect(repeatedName(named("Ali", "Abu", "Siti"))).toBeUndefined();
  });

  it("finds a repeat, ignoring capitals", () => {
    expect(repeatedName(named("Ali", "Abu", "ALI"))).toBe("ALI");
  });
});

describe("member items", () => {
  const memberItem: Item = {
    id: "f",
    name: "Petrol",
    amountMinor: 6000,
    paidBy: "n",
    participants: all,
    overrides: {},
    addedAt: "2026-10-31T10:00:00.000Z",
  };
  const withMember: BillDoc = { ...houseBills, items: [...houseBills.items, memberItem] };
  const ids = (doc: BillDoc) => doc.items.map((i) => i.id);

  it("brings in an item the owner has not seen", () => {
    expect(ids(mergeMemberChanges(withMember, houseBills, ""))).toEqual(["1", "2", "3", "f"]);
  });

  it("keeps an item deleted once the owner has seen it", () => {
    expect(ids(mergeMemberChanges(withMember, houseBills, memberItem.addedAt!))).toEqual(["1", "2", "3"]);
  });

  it("drops an item the member undid", () => {
    expect(ids(mergeMemberChanges(houseBills, withMember, memberItem.addedAt!))).toEqual(["1", "2", "3"]);
  });

  it("keeps the owner's edit without a duplicate", () => {
    const edited: Item = { ...memberItem, name: "Petrol + toll", addedAt: undefined };
    const local = { ...houseBills, items: [...houseBills.items, edited] };
    const merged = mergeMemberChanges(withMember, local, "");
    expect(ids(merged)).toEqual(["1", "2", "3", "f"]);
    expect(merged.items[3].name).toBe("Petrol + toll");
  });

  it("does not touch the owner's own items", () => {
    const local = { ...houseBills, items: [...houseBills.items, { ...houseBills.items[0], id: "new" }] };
    expect(ids(mergeMemberChanges(houseBills, local, ""))).toEqual(["1", "2", "3", "new"]);
  });

  it("skips an item for a person the owner removed", () => {
    const local = { ...houseBills, people: people.filter((p) => p.id !== "n"), items: [] };
    expect(ids(mergeMemberChanges(withMember, local, ""))).toEqual([]);
  });

  it("tracks the latest added time", () => {
    expect(latestMemberChange(houseBills)).toBe("");
    expect(latestMemberChange(withMember)).toBe(memberItem.addedAt);
    expect(latestMemberChange(houseBills, "2026-01-01")).toBe("2026-01-01");
  });

  it("settles a trip where each member paid for something different", () => {
    const trio = people.slice(0, 3);
    const everyone = trio.map((p) => p.id);
    const trip: BillDoc = {
      ...houseBills,
      people: trio,
      items: [
        { id: "1", name: "Hotel", amountMinor: 30000, paidBy: "h", participants: everyone, overrides: {} },
        { ...memberItem, id: "2", amountMinor: 6000, paidBy: "n", participants: everyone },
        { ...memberItem, id: "3", name: "Food", amountMinor: 9000, paidBy: "a", participants: everyone },
      ],
    };
    const lines = summarize(trip).remaining.map((l) => [l.from, l.to, l.amount]);
    expect(lines).toEqual([
      ["n", "h", 9000],
      ["a", "h", 6000],
    ]);
  });
});

describe("splitItem", () => {
  it("splits equally by default", () => {
    expect(splitItem(20160, all, {})).toEqual({ ok: true, shares: { h: 5040, n: 5040, a: 5040, i: 5040 } });
  });

  it("re-splits the rest when one amount is typed", () => {
    expect(splitItem(12000, all, { h: 4000 })).toEqual({ ok: true, shares: { h: 4000, n: 2667, a: 2667, i: 2666 } });
  });

  it("flags typed amounts that exceed the bill", () => {
    expect(splitItem(1000, all, { h: 800, n: 300 })).toEqual({ ok: false, error: "over", diff: 100 });
  });

  it("flags when everyone is typed but it doesn't add up", () => {
    expect(splitItem(1000, ["h", "n"], { h: 300, n: 300 })).toEqual({ ok: false, error: "under", diff: 400 });
  });

  it("leaves unticked people out", () => {
    expect(splitItem(900, ["h", "n", "a"], {})).toEqual({ ok: true, shares: { h: 300, n: 300, a: 300 } });
  });
});

describe("summarize (the splitinn screenshot)", () => {
  const s = summarize(houseBills);

  it("totals and equal share", () => {
    expect(s.total).toBe(47380);
    expect(s.sameShare).toBe(11845);
  });

  it("who pays who", () => {
    expect(s.remaining).toEqual([
      { from: "n", to: "h", amount: 11845 },
      { from: "i", to: "h", amount: 3530 },
      { from: "i", to: "a", amount: 8315 },
    ]);
  });

  it("marked payments move from remaining to done", () => {
    const after = summarize(houseBills, [
      { id: "p1", from: "n", to: "h", amountMinor: 11845, byRole: "member", createdAt: "2026-10-05T14:00:00Z" },
    ]);
    expect(after.done).toHaveLength(1);
    expect(after.remaining).toEqual([
      { from: "i", to: "h", amount: 3530 },
      { from: "i", to: "a", amount: 8315 },
    ]);
  });
});

describe("itemSplitText", () => {
  const fmt = (m: number) => formatMoney(m, "MYR").replace(/[^\d.,]/g, "");
  const words = { each: "EACH", about: "ABOUT", others: "OTHERS", not: "NOT" };
  const bill = (amountMinor: number, overrides: Record<string, number> = {}, participants = all) => ({
    id: "x",
    name: "Bill",
    amountMinor,
    paidBy: "h",
    participants,
    overrides,
  });

  it("an even split", () => {
    expect(itemSplitText(bill(10000), people, fmt, words)).toBe("25.00 EACH");
  });

  it("a sen left over reads as about", () => {
    expect(itemSplitText(bill(10000, {}, ["h", "n", "a"]), people, fmt, words)).toBe("ABOUT 33.33 EACH · NOT IMANUL");
  });

  it("a typed amount, the rest shared", () => {
    expect(itemSplitText(bill(3000, { h: 500 }, ["h", "n", "a"]), people, fmt, words)).toBe(
      "HAZIQ 5.00 · OTHERS 12.50 EACH · NOT IMANUL",
    );
  });

  it("people left out", () => {
    expect(itemSplitText(bill(9000, {}, ["h", "n", "a"]), people, fmt, words)).toBe("30.00 EACH · NOT IMANUL");
  });

  it("only one person", () => {
    expect(itemSplitText(bill(3000, {}, ["n"]), people, fmt, words)).toBe("NAJMI 30.00 · NOT HAZIQ, AFIQ, IMANUL");
  });
});

describe("evenShare", () => {
  const bill = (amountMinor: number, overrides: Record<string, number> = {}, participants = all) => ({
    id: "x",
    name: "Electricity",
    amountMinor,
    paidBy: "h",
    participants,
    overrides,
  });

  it("is exact when the amount divides evenly", () => {
    expect(evenShare(bill(10000), 4)).toEqual({ amount: 2500, exact: true });
  });

  it("is still an equal split when one sen is left over", () => {
    expect(splitItem(24090, all, {})).toMatchObject({ ok: true, shares: { h: 6023, n: 6023, a: 6022, i: 6022 } });
    expect(evenShare(bill(24090), 4)).toEqual({ amount: 6023, exact: false });
    expect(evenShare(bill(10000, {}, ["h", "n", "a"]), 3)).toEqual({ amount: 3333, exact: false });
  });

  it("is null for typed amounts or people left out", () => {
    expect(evenShare(bill(12000, { h: 4000 }), 4)).toBeNull();
    expect(evenShare(bill(9000, {}, ["h", "n", "a"]), 4)).toBeNull();
  });
});

describe("mineOf", () => {
  const rights: BillRights = {
    people: { a: "me", b: "them" },
    items: { one: "me", two: "them" },
    joins: { one: { a: "me", b: "them" } },
    payments: { p1: "me", p2: "them" },
  };

  it("lists only what this browser added", () => {
    expect(mineOf(rights, "them", "me")).toEqual({
      owner: false,
      people: ["a"],
      items: ["one"],
      joins: [{ itemId: "one", personId: "a" }],
      payments: ["p1"],
    });
  });

  it("knows the browser that created the bill", () => {
    expect(mineOf({}, "me", "me").owner).toBe(true);
  });

  it("gives nothing to a browser with no key", () => {
    expect(mineOf(rights, null, null)).toEqual({ owner: false, people: [], items: [], joins: [], payments: [] });
  });
});
