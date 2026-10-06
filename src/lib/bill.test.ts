import { describe, expect, it } from "vitest";
import { evenShare, itemSplitText, splitItem, summarize, type BillDoc } from "./bill";
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
      { id: "p1", from: "n", to: "h", amountMinor: 11845, markedBy: "payer", createdAt: "2026-10-05T14:00:00Z" },
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
