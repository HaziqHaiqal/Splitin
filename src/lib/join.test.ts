import { describe, expect, it } from "vitest";
import {
  activePeople,
  itemShares,
  joinItem,
  joinShare,
  leaveItem,
  mergeMemberChanges,
  ownerOf,
  previewMyBills,
  previewPayment,
  summarize,
  withItem,
  withNewPeople,
  withoutPerson,
  withShare,
  type BillDoc,
  type Item,
  type Payment,
} from "./bill";
import { diffDocs, memberWho } from "./history";

const people = [
  { id: "h", name: "Haziq", color: 0 },
  { id: "n", name: "Najmi", color: 1 },
  { id: "a", name: "Afiq", color: 2 },
  { id: "i", name: "Imanul", color: 3 },
];
const all = people.map((p) => p.id);
const join = { at: "2026-10-31T10:00:00.000Z" };
const seenAt = "2026-10-31T09:00:00.000Z";

const electricity: Item = {
  id: "1",
  name: "Electricity",
  amountMinor: 20160,
  paidBy: "a",
  participants: all,
  overrides: {},
};
const house: BillDoc = {
  title: "House",
  currency: "MYR",
  createdAt: "2026-10-05T13:40:00Z",
  ownerId: "h",
  people,
  items: [
    electricity,
    { id: "2", name: "Water", amountMinor: 18000, paidBy: "h", participants: all, overrides: {} },
    { id: "3", name: "Wifi", amountMinor: 9220, paidBy: "h", participants: all, overrides: {} },
  ],
};
const aiman = { id: "m", name: "Aiman", color: 4, addedAt: join.at };
const withAiman: BillDoc = { ...house, people: [...people, aiman] };
const shareOf = (doc: BillDoc, id: string) => summarize(doc).people.find((p) => p.id === id)?.share;

describe("ownerOf", () => {
  it("is the chosen person", () => expect(ownerOf({ ...house, ownerId: "a" })?.name).toBe("Afiq"));
  it("is the first person on older bills", () => expect(ownerOf({ ...house, ownerId: undefined })?.name).toBe("Haziq"));
  it("is nobody when the owner is not on the list", () => expect(ownerOf({ ...house, ownerId: null })).toBeUndefined());
});

describe("activePeople", () => {
  it("ignores a name that is in no bill, so the amounts text stays the same", () => {
    expect(activePeople(withAiman).map((p) => p.id)).toEqual(all);
    expect(summarize(withAiman).sameShare).toBe(11845);
  });
  it("counts a name once they join a bill", () => {
    const doc = { ...withAiman, items: [joinItem(electricity, "m", undefined, join)!, ...house.items.slice(1)] };
    expect(activePeople(doc).map((p) => p.id)).toContain("m");
    expect(summarize(doc).sameShare).toBeNull();
  });
  it("lists everyone before any bill exists", () => {
    expect(activePeople({ ...withAiman, items: [] })).toHaveLength(5);
  });
});

describe("joining a bill", () => {
  it("works out the share automatically", () => {
    expect(joinShare(electricity, "m")).toBe(4032);
    const doc = { ...withAiman, items: [joinItem(electricity, "m", undefined, join)!, ...house.items.slice(1)] };
    expect(shareOf(doc, "m")).toBe(4032);
    expect(shareOf(doc, "n")).toBe(10837);
  });

  it("uses a written amount and spreads the rest", () => {
    expect(joinShare(electricity, "m", 3000)).toBe(3000);
    const doc = { ...withAiman, items: [joinItem(electricity, "m", 3000, join)!, ...house.items.slice(1)] };
    expect(shareOf(doc, "m")).toBe(3000);
    expect(shareOf(doc, "n")).toBe(11095);
  });

  it("splits the whole set when joining all", () => {
    const doc = { ...withAiman, items: house.items.map((i) => joinItem(i, "m", undefined, join)!) };
    expect(shareOf(doc, "m")).toBe(9476);
    expect(shareOf(doc, "h")).toBe(9476);
  });

  it("refuses a written amount above the bill", () => {
    expect(joinShare(electricity, "m", 20161)).toBeNull();
    expect(joinItem(electricity, "m", 20161, join)).toBeNull();
  });

  it("refuses a bill where every amount is already set", () => {
    const set = { ...electricity, participants: ["h", "n"], overrides: { h: 10000, n: 10160 } };
    expect(joinShare(set, "m")).toBeNull();
    expect(joinShare(set, "m", 100)).toBeNull();
  });

  it("keeps the other people's written amounts", () => {
    const item = joinItem({ ...electricity, overrides: { h: 5000 } }, "m", undefined, join)!;
    expect(item.overrides).toEqual({ h: 5000 });
    expect(itemShares(item).h).toBe(5000);
  });

  it("pays back someone who already paid more than their new share", () => {
    const paid: Payment = {
      id: "p1",
      from: "n",
      to: "a",
      amountMinor: 11845,
      byRole: "member",
      createdAt: "2026-10-31T08:00:00.000Z",
    };
    const doc = { ...withAiman, items: [joinItem(electricity, "m", undefined, join)!, ...house.items.slice(1)] };
    const back = summarize(doc, [paid]).remaining.filter((l) => l.to === "n");
    expect(back.reduce((sum, l) => sum + l.amount, 0)).toBe(1008);
  });
});

describe("leaving a bill", () => {
  const joined = joinItem(electricity, "m", 3000, join)!;

  it("removes the person, their amount and their key", () => {
    const left = leaveItem(joined, "m")!;
    expect(left.participants).toEqual(all);
    expect(left.overrides).toEqual({});
    expect(left.joins).toBeUndefined();
  });

  it("refuses when it would leave the bill unpaid", () => {
    expect(leaveItem({ ...joined, participants: ["m"], overrides: {} }, "m")).toBeNull();
    expect(leaveItem({ ...joined, overrides: { h: 1000, n: 1000, a: 1000, i: 1000, m: 16160 } }, "m")).toBeNull();
  });
});

describe("changing your part", () => {
  it("writes your amount and leaves the rest equal for everyone else", () => {
    const next = withShare(electricity, "n", 3000)!;
    expect(next.overrides).toEqual({ n: 3000 });
    expect(itemShares(next)).toEqual({ h: 5720, n: 3000, a: 5720, i: 5720 });
  });

  it("goes back to equal when no amount is written", () => {
    const next = withShare({ ...electricity, overrides: { n: 3000, h: 1000 } }, "n", undefined)!;
    expect(next.overrides).toEqual({ h: 1000 });
  });

  it("adds you when you are not in the bill yet, and keeps no key", () => {
    const next = withShare(electricity, "m", undefined)!;
    expect(next.participants).toEqual([...all, "m"]);
    expect(next.joins).toBeUndefined();
  });

  it("refuses an amount above what is left", () => {
    expect(withShare({ ...electricity, overrides: { h: 20000 } }, "n", 161)).toBeNull();
  });
});

describe("withItem", () => {
  it("swaps one bill and keeps the order and the others as they were", () => {
    const water = { ...house.items[1], amountMinor: 20000 };
    const next = withItem(house, water);
    expect(next.items.map((i) => i.id)).toEqual(["1", "2", "3"]);
    expect(next.items[1].amountMinor).toBe(20000);
    expect(next.items[0]).toBe(house.items[0]);
    expect(house.items[1].amountMinor).toBe(18000);
  });

  it("changes nothing when the bill is not there", () => {
    expect(withItem(house, { ...electricity, id: "x" }).items).toEqual(house.items);
  });
});

describe("withNewPeople", () => {
  it("adds a name with the next colour", () => {
    const doc = withNewPeople(house, [{ id: "m", name: "Aiman" }], join.at)!;
    expect(doc.people[4]).toEqual({ id: "m", name: "Aiman", color: 4, addedAt: join.at });
  });
  it("refuses a name already on the bill, in any case", () => {
    expect(withNewPeople(house, [{ id: "m", name: "najmi" }], join.at)).toBeNull();
  });
  it("refuses the same name twice in one go", () => {
    const twice = [
      { id: "m", name: "Aiman" },
      { id: "o", name: "AIMAN" },
    ];
    expect(withNewPeople(house, twice, join.at)).toBeNull();
  });
  it("refuses an id already on the bill", () => {
    expect(withNewPeople(house, [{ id: "n", name: "Aiman" }], join.at)).toBeNull();
  });
});

describe("withoutPerson", () => {
  it("strips them from every bill, with their amount and key", () => {
    const item = joinItem({ ...electricity, overrides: { h: 1000 } }, "m", 3000, join)!;
    const doc = withoutPerson({ ...withAiman, items: [item] }, "m");
    expect(doc.people.map((p) => p.id)).toEqual(all);
    expect(doc.items[0].participants).toEqual(all);
    expect(doc.items[0].overrides).toEqual({ h: 1000 });
    expect(doc.items[0].joins).toBeUndefined();
  });
  it("clears written amounts that no longer add up", () => {
    const item = { ...electricity, participants: ["h", "n"], overrides: { h: 10000, n: 10160 } };
    expect(withoutPerson({ ...house, items: [item] }, "n").items[0].overrides).toEqual({});
  });
  it("drops a bill with nobody left", () => {
    const item = { ...electricity, participants: ["n"] };
    expect(withoutPerson({ ...house, items: [item] }, "n").items).toEqual([]);
  });
  it("forgets the owner when the owner is removed", () => {
    expect(withoutPerson(house, "h").ownerId).toBeNull();
  });
});

describe("mergeMemberChanges", () => {
  const snacks: Item = {
    id: "s",
    name: "Snacks",
    amountMinor: 1000,
    paidBy: "m",
    participants: ["m", "n"],
    overrides: {},
    addedAt: join.at,
  };
  const server: BillDoc = {
    ...withAiman,
    items: [joinItem(electricity, "m", 3000, join)!, ...house.items.slice(1), snacks],
  };

  it("keeps a new name, a join and a member's bill when the owner saves an old copy", () => {
    const merged = mergeMemberChanges(server, { ...house, title: "Renamed" }, seenAt);
    expect(merged.title).toBe("Renamed");
    expect(merged.people.map((p) => p.id)).toContain("m");
    expect(merged.items.map((i) => i.id)).toContain("s");
    const item = merged.items.find((i) => i.id === "1")!;
    expect(item.participants).toContain("m");
    expect(item.overrides.m).toBe(3000);
    expect(item.joins?.m).toEqual(join);
  });

  it("writes no false History line for what members did", () => {
    const merged = mergeMemberChanges(server, { ...house, title: "Renamed" }, seenAt);
    expect(diffDocs(server, merged)).toEqual([{ kind: "title_changed", to: "Renamed" }]);
  });

  it("sees that a member left, even if the owner's copy still has them", () => {
    const local = { ...withAiman, items: [joinItem(electricity, "m", 3000, join)!, ...house.items.slice(1)] };
    const left = { ...withAiman, items: house.items };
    const item = mergeMemberChanges(left, local, seenAt).items[0];
    expect(item.participants).toEqual(all);
    expect(item.overrides).toEqual({});
    expect(item.joins).toBeUndefined();
  });

  it("lets the owner remove someone a member added", () => {
    const local = withoutPerson(server, "m");
    const merged = mergeMemberChanges(server, local, join.at);
    expect(merged.people.map((p) => p.id)).toEqual(all);
    expect(merged.items.every((i) => !i.participants.includes("m"))).toBe(true);
  });

  it("lets the owner take a member off a bill they have already seen", () => {
    const local = { ...server, items: [electricity, ...server.items.slice(1)] };
    expect(mergeMemberChanges(server, local, join.at).items[0].participants).toEqual(all);
  });

  it("drops a written amount that no longer fits the owner's new total", () => {
    const local = { ...house, items: [{ ...electricity, amountMinor: 2000 }, ...house.items.slice(1)] };
    const item = mergeMemberChanges(server, local, seenAt).items[0];
    expect(item.participants).toContain("m");
    expect(item.overrides.m).toBeUndefined();
    expect(itemShares(item).m).toBe(400);
  });

  it("keeps bank details a member added", () => {
    const details = { ...aiman, bank: "Maybank", accountNo: "123", payQr: "000201QR", detailsAt: join.at };
    const merged = mergeMemberChanges({ ...withAiman, people: [...people, details] }, withAiman, seenAt);
    expect(merged.people[4].bank).toBe("Maybank");
    expect(merged.people[4].payQr).toBe("000201QR");
  });

  it("takes the lock from the server, not from the owner's copy", () => {
    expect(mergeMemberChanges({ ...house, locked: true }, house, seenAt).locked).toBe(true);
    expect(mergeMemberChanges(house, { ...house, locked: true }, seenAt).locked).toBeUndefined();
  });
});

describe("memberWho", () => {
  it("names a member", () => expect(memberWho(house, "n").name).toBe("Najmi"));
  it("does not let someone pose as the owner", () => expect(memberWho(house, "h").name).toBeUndefined());
  it("ignores an unknown id", () => expect(memberWho(house, "zzz").name).toBeUndefined());
  it("names the first person when the owner is someone else", () => {
    expect(memberWho({ ...house, ownerId: "a" }, "h").name).toBe("Haziq");
  });
});

describe("previewMyBills", () => {
  const doc: BillDoc = {
    title: "Trip",
    currency: "MYR",
    createdAt: "",
    people: [...people, { id: "z", name: "Aiman", color: 3 }],
    items: [
      { id: "a", name: "A", amountMinor: 3000, paidBy: "h", participants: ["h"], overrides: {} },
      {
        id: "b",
        name: "B",
        amountMinor: 4000,
        paidBy: "h",
        participants: ["h", "z"],
        overrides: {},
        joins: { z: { at: "" } },
      },
    ],
  };

  it("gives the same shares as joining and leaving for real", () => {
    const next = previewMyBills(doc, "z", {
      join: [{ itemId: "a", written: 500 }],
      change: [],
      leave: [{ itemId: "b" }],
    });
    expect(next.items[0]).toEqual(joinItem(doc.items[0], "z", 500, { at: "" }));
    expect(next.items[1]).toEqual(leaveItem(doc.items[1], "z"));
  });

  it("leaves a bill alone when the written amount is too much", () => {
    const next = previewMyBills(doc, "z", { join: [{ itemId: "a", written: 9000 }], change: [], leave: [] });
    expect(next.items[0]).toEqual(doc.items[0]);
  });

  it("does not change the bill it was given", () => {
    const before = JSON.stringify(doc);
    previewMyBills(doc, "z", { join: [{ itemId: "a" }], change: [], leave: [] });
    expect(JSON.stringify(doc)).toBe(before);
  });
});

describe("previewPayment", () => {
  it("counts as paid and leaves the rest to pay", () => {
    const doc: BillDoc = {
      title: "Trip",
      currency: "MYR",
      createdAt: "",
      people: people.slice(0, 2),
      items: [
        {
          id: "a",
          name: "A",
          amountMinor: 3000,
          paidBy: people[0].id,
          participants: [people[0].id, people[1].id],
          overrides: {},
        },
      ],
    };
    const summary = summarize(doc, [previewPayment({ from: people[1].id, to: people[0].id, amountMinor: 1000 })]);
    expect(summary.done).toHaveLength(1);
    expect(summary.remaining[0].amount).toBe(500);
  });
});
