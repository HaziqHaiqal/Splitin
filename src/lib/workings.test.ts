import { describe, expect, it } from "vitest";
import type { BillDoc, Item } from "./bill";
import { workings } from "./workings";

const everyone = ["hf", "hz", "fz", "sm", "am"];
const item = (id: string, amountMinor: number, paidBy: string, participants = everyone): Item => ({
  id,
  name: id,
  amountMinor,
  paidBy,
  participants,
  overrides: {},
});

const doc: BillDoc = {
  title: "Derma",
  currency: "MYR",
  createdAt: "2026-11-03T03:00:00.000Z",
  ownerId: "hf",
  people: everyone.map((id, color) => ({ id, name: id, color })),
  items: [
    item("derma", 500000, "hf"),
    item("ahlong", 200000, "hz"),
    item("makan", 30000, "am", ["hf", "fz", "sm", "am"]),
  ],
};

describe("workings", () => {
  const w = workings(doc);

  it("starts with everyone owing the first payer", () => {
    expect(w.steps[0].changes).toEqual(
      ["hz", "fz", "sm", "am"].map((from) => ({ kind: "new", from, to: "hf", amount: 100000 })),
    );
  });

  it("cancels debts that go both ways", () => {
    expect(w.steps[1].changes[0]).toEqual({
      kind: "cancel",
      ower: "hf",
      owed: "hz",
      owes: 40000,
      back: 100000,
      from: "hz",
      to: "hf",
      amount: 60000,
    });
    expect(w.steps[2].changes.find((c) => c.kind === "cancel")).toMatchObject({ from: "am", to: "hf", amount: 92500 });
  });

  it("adds up to each person's balance and the fewest payments", () => {
    expect(w.debts).toHaveLength(9);
    expect(Object.fromEntries(w.tally.map((t) => [t.id, t.net]))).toEqual({
      hf: 352500,
      hz: 60000,
      fz: -147500,
      sm: -147500,
      am: -117500,
    });
    expect(w.plan.map((l) => [l.from, l.to, l.amount])).toEqual([
      ["fz", "hf", 147500],
      ["sm", "hf", 147500],
      ["am", "hf", 57500],
      ["am", "hz", 60000],
    ]);
  });

  it("counts payments already marked, like the receipt", () => {
    const early = { id: "p1", from: "hz", to: "hf", amountMinor: 100000, byRole: "member" as const, createdAt: "" };
    const paid = workings(doc, [early]);
    expect(paid.paid).toEqual([{ from: "hz", to: "hf", amount: 100000 }]);
    expect(paid.after).toMatchObject({ hf: 252500, hz: 160000 });
    expect(paid.plan.reduce((sum, l) => sum + l.amount, 0)).toBe(412500);
    expect(paid.plan.some((l) => l.from === "hz")).toBe(false);
  });

  it("adds to a debt that already goes the same way", () => {
    const more = workings({ ...doc, items: [item("a", 300, "hf", ["hf", "hz"]), item("b", 500, "hf", ["hf", "hz"])] });
    expect(more.steps[1].changes).toEqual([
      { kind: "more", from: "hz", to: "hf", before: 150, added: 250, amount: 400 },
    ]);
  });
});
