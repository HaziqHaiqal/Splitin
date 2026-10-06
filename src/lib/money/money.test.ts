import { describe, expect, it } from "vitest";
import {
  computeBalances,
  computeItemized,
  computeSplit,
  formatMoney,
  parseMoney,
  simplifyDebts,
  splitByWeights,
  splitEqual,
  type Allocation,
} from "./index";

const sum = (a: Allocation) => Object.values(a).reduce((s, v) => s + v, 0);

describe("splitEqual", () => {
  it("never loses a sen: RM100 / 3", () => {
    const out = splitEqual(10000, ["a", "b", "c"]);
    expect(out).toEqual({ a: 3334, b: 3333, c: 3333 });
    expect(sum(out)).toBe(10000);
  });

  it("handles negative totals symmetrically", () => {
    expect(splitEqual(-100, ["a", "b", "c"])).toEqual({ a: -34, b: -33, c: -33 });
  });

  it("rejects an empty participant list", () => {
    expect(() => splitEqual(100, [])).toThrow();
  });
});

describe("splitByWeights", () => {
  it("splits 2:1:1 exactly", () => {
    const out = splitByWeights(10001, { a: 2, b: 1, c: 1 });
    expect(sum(out)).toBe(10001);
    expect(out.a).toBe(5001);
  });

  it("gives zero to zero-weight members", () => {
    expect(splitByWeights(900, { a: 1, b: 0, c: 2 })).toEqual({ a: 300, b: 0, c: 600 });
  });
});

describe("computeItemized", () => {
  // Nasi lemak 12.00 (a), teh tarik 2 × 3.50 (b), shared satay 18.00 (a,b,c)
  const items = [
    { name: "Nasi lemak", unitPriceMinor: 1200, qty: 1, assignees: ["a"] },
    { name: "Teh tarik", unitPriceMinor: 350, qty: 2, assignees: ["b"] },
    { name: "Satay", unitPriceMinor: 1800, qty: 1, assignees: ["a", "b", "c"] },
  ];

  it("applies 10% service then 6% SST and sums exactly", () => {
    const r = computeItemized(items, { servicePct: 10, taxPct: 6 });
    expect(r.subtotal).toBe(3700);
    expect(r.service).toBe(370);
    expect(r.tax).toBe(244); // 6% of 4070 = 244.2
    expect(r.total).toBe(4314);
    expect(sum(r.shares)).toBe(r.total);
    expect(r.subtotals).toEqual({ a: 1800, b: 1300, c: 600 });
  });

  it("reconciles to the printed receipt total (e.g. 5-sen rounding)", () => {
    const r = computeItemized(items, { servicePct: 10, taxPct: 6, receiptTotalMinor: 4315 });
    expect(r.total).toBe(4315);
    expect(r.adjustment).toBe(1);
    expect(sum(r.shares)).toBe(4315);
  });

  it("applies a discount proportionally", () => {
    const r = computeItemized(items, { discountMinor: 700 });
    expect(r.total).toBe(3000);
    expect(sum(r.shares)).toBe(3000);
  });

  it("reports unassigned items", () => {
    const r = computeItemized([{ name: "x", unitPriceMinor: 500, qty: 1, assignees: [] }]);
    expect(r.unassigned).toBe(500);
  });
});

describe("computeSplit", () => {
  it("equal", () => {
    const r = computeSplit({ mode: "equal", total: 10000, participants: ["a", "b", "c"] });
    expect(r.ok && sum(r.splits)).toBe(10000);
  });

  it("exact must match the total", () => {
    const r = computeSplit({ mode: "exact", total: 1000, amounts: { a: 600, b: 300 } });
    expect(r).toEqual({ ok: false, error: "exact_mismatch", diff: 100 });
  });

  it("exact without a total uses the sum", () => {
    const r = computeSplit({ mode: "exact", total: 0, amounts: { a: 600, b: 300 } });
    expect(r).toEqual({ ok: true, total: 900, splits: { a: 600, b: 300 } });
  });

  it("itemized refuses unassigned items", () => {
    const r = computeSplit({
      mode: "itemized",
      items: [{ name: "x", unitPriceMinor: 500, qty: 1, assignees: [] }],
      extras: {},
    });
    expect(r.ok).toBe(false);
  });
});

describe("balances and settle-up", () => {
  const members = ["ali", "abu", "siti", "mei"];
  const expenses = [
    // Ali paid 120 split 4 ways
    {
      payers: [{ memberId: "ali", amountMinor: 12000 }],
      splits: members.map((m) => ({ memberId: m, amountMinor: 3000 })),
    },
    // Siti paid 45 for Abu and herself
    {
      payers: [{ memberId: "siti", amountMinor: 4500 }],
      splits: [
        { memberId: "abu", amountMinor: 2250 },
        { memberId: "siti", amountMinor: 2250 },
      ],
    },
    // Two payers
    {
      payers: [
        { memberId: "mei", amountMinor: 5000 },
        { memberId: "abu", amountMinor: 1001 },
      ],
      splits: Object.entries(splitEqual(6001, members)).map(([memberId, amountMinor]) => ({ memberId, amountMinor })),
    },
  ];

  it("balances sum to zero", () => {
    expect(sum(computeBalances(members, expenses))).toBe(0);
  });

  it("transfers clear every balance in at most n − 1 steps", () => {
    const balances = computeBalances(members, expenses);
    const transfers = simplifyDebts(balances);
    expect(transfers.length).toBeLessThanOrEqual(members.length - 1);
    const settled = computeBalances(
      members,
      expenses,
      transfers.map((t) => ({ fromMember: t.from, toMember: t.to, amountMinor: t.amount })),
    );
    expect(Object.values(settled).every((v) => v === 0)).toBe(true);
  });

  it("partial settlement reduces the debt", () => {
    const balances = computeBalances(
      ["a", "b"],
      [{ payers: [{ memberId: "a", amountMinor: 1000 }], splits: [{ memberId: "b", amountMinor: 1000 }] }],
      [{ fromMember: "b", toMember: "a", amountMinor: 400 }],
    );
    expect(balances).toEqual({ a: 600, b: -600 });
    expect(simplifyDebts(balances)).toEqual([{ from: "b", to: "a", amount: 600 }]);
  });
});

describe("format / parse", () => {
  it("formats MYR", () => {
    expect(formatMoney(3334, "MYR")).toMatch(/RM\s?33\.34/);
  });

  it("formats JPY with no decimals", () => {
    expect(formatMoney(1500, "JPY")).toMatch(/1,500/);
    expect(formatMoney(1500, "JPY")).not.toMatch(/\./);
  });

  it("parses without float error", () => {
    expect(parseMoney("0.29", "MYR")).toBe(29);
    expect(parseMoney("1,234.5", "MYR")).toBe(123450);
    expect(parseMoney("12.", "MYR")).toBe(1200);
    expect(parseMoney("1.234", "MYR")).toBeNull();
    expect(parseMoney("abc", "MYR")).toBeNull();
    expect(parseMoney("1500", "JPY")).toBe(1500);
    expect(parseMoney("1.5", "JPY")).toBeNull();
  });
});
