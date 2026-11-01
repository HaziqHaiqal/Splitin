import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { saveArgs } from "../src/lib/bill-rows";
import type { BillDoc } from "../src/lib/bill";
import {
  BILL,
  button,
  createBill,
  closePhones,
  database,
  getDb,
  hotel,
  must,
  newPhone,
  ownerStorage,
  paymentRow,
  pickMe,
  seed,
  serverDoc,
  sheet,
  submit,
  startAdding,
  openBill,
  text,
  trip,
  wipe,
} from "./helpers";

const TABLES = ["bills", "bill_people", "bill_items", "item_shares", "payments", "bill_events", "expired_bills"];
const FUNCTIONS = ["log_events", "save_bill", "create_bill", "add_payment", "remove_payment", "delete_old_bills"];
const NEVER = "2020-01-01T00:00:00.000Z";

async function save(doc: BillDoc, version?: number) {
  const bill = (await getDb()).bills[0];
  return database.rpc("save_bill", {
    p_id: bill.id,
    p_version: version ?? bill.version,
    ...saveArgs(doc, bill.rights),
    p_events: [{ kind: "item_added", by_role: "owner", by_person_id: "h", by_name: "Haziq", data: {} }],
  });
}

const payment = (id: string) => ({
  id,
  from_person: "n",
  to_person: "h",
  amount_minor: 10000,
  by_role: "member",
  browser_hash: null,
});

test.afterEach(() => closePhones());

test.describe("the database itself", () => {
  test.beforeEach(() => seed());

  test("gives back what was saved, in the same order", async () => {
    const doc: BillDoc = {
      ...trip,
      locked: true,
      people: [
        { id: "a", name: "Afiq", color: 2, bank: "Maybank", accountNo: "123", detailsAt: "2026-10-31T02:00:00.000Z" },
        { id: "h", name: "Haziq", color: 0, addedAt: "2026-10-31T03:00:00.000Z" },
        { id: "n", name: "Najmi", color: 1 },
      ],
      items: [
        { ...hotel, participants: ["n", "a", "h"], overrides: { a: 500 }, addedAt: "2026-10-31T04:00:00.000Z" },
        { ...hotel, id: "second", name: "Second", participants: ["h", "n"], joins: { n: { at: trip.createdAt } } },
      ],
    };
    await must(save(doc));
    const saved = await serverDoc();
    expect(saved.createdAt).toBe(trip.createdAt);
    expect(saved.locked).toBe(true);
    expect(saved.people.map((p) => p.id)).toEqual(["a", "h", "n"]);
    expect(saved.people[0]).toMatchObject({ bank: "Maybank", accountNo: "123", detailsAt: doc.people[0].detailsAt });
    expect(saved.people[1].addedAt).toBe(doc.people[1].addedAt);
    expect(saved.items[0]).toMatchObject({
      participants: ["n", "a", "h"],
      overrides: { a: 500 },
      addedAt: doc.items[0].addedAt,
    });
    expect(saved.items[1].joins).toEqual({ n: { at: trip.createdAt } });
  });

  test("refuses a repeated name, ignoring capitals, and leaves nothing behind", async () => {
    const before = await getDb();
    const { error } = await save({ ...trip, people: [...trip.people, { id: "x", name: "NAJMI", color: 3 }] });
    expect(error?.code).toBe("23505");
    const after = await getDb();
    expect(after.bills[0]).toEqual(before.bills[0]);
    expect(after.bill_events).toHaveLength(0);
  });

  test("lets two people swap names", async () => {
    const swapped = {
      ...trip,
      people: trip.people.map((p) =>
        p.id === "h" ? { ...p, name: "Najmi" } : p.id === "n" ? { ...p, name: "Haziq" } : p,
      ),
    };
    await must(save(swapped));
    expect((await serverDoc()).people.map((p) => p.name)).toEqual(["Najmi", "Haziq", "Afiq"]);
  });

  test("refuses removing someone who has a payment, and leaves nothing behind", async () => {
    await seed({ ...trip, items: [{ ...hotel, participants: ["h", "a"] }] }, { payments: [paymentRow("n", "h", 100)] });
    const before = await getDb();
    const { error } = await save({
      ...before.bills[0].doc,
      people: before.bills[0].doc.people.filter((p) => p.id !== "n"),
    });
    expect(error?.code).toBe("23503");
    const after = await getDb();
    expect(after.bills[0]).toEqual(before.bills[0]);
    expect(after.bill_events).toHaveLength(0);
  });

  test("keeps a person's name in History after they are removed", async () => {
    await must(
      database
        .from("bill_events")
        .insert({ bill_id: BILL, kind: "paid", by_role: "member", by_person_id: "a", by_name: "Afiq" }),
    );
    await must(save({ ...trip, people: trip.people.filter((p) => p.id !== "a"), items: [] }));
    const event = (await getDb()).bill_events[0];
    expect(event).toMatchObject({ by_person_id: null, by_name: "Afiq" });
  });

  test("refuses a save from an old copy", async () => {
    const { version } = (await getDb()).bills[0];
    await must(save({ ...trip, title: "First" }));
    const { data, error } = await save({ ...trip, title: "Second" }, version);
    expect(error).toBeNull();
    expect(data).toBeNull();
    const after = await getDb();
    expect(after.bills[0].doc.title).toBe("First");
    expect(after.bill_events).toHaveLength(1);
  });

  test("two phones marking at the same moment record one payment", async () => {
    const { version } = (await getDb()).bills[0];
    const results = await Promise.all(
      [crypto.randomUUID(), crypto.randomUUID()].map((id) =>
        must(database.rpc("add_payment", { p_id: BILL, p_version: version, p_payment: payment(id), p_events: [] })),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await getDb()).payments).toHaveLength(1);
  });

  test("undoing a payment twice logs it once", async () => {
    const id = crypto.randomUUID();
    const { version } = (await getDb()).bills[0];
    await must(database.rpc("add_payment", { p_id: BILL, p_version: version, p_payment: payment(id), p_events: [] }));
    const undo = () =>
      must(
        database.rpc("remove_payment", {
          p_id: BILL,
          p_payment_id: id,
          p_events: [{ kind: "unpaid", by_role: "owner", data: {} }],
        }),
      );
    expect(await undo()).toBe(true);
    expect(await undo()).toBe(false);
    expect((await getDb()).bill_events).toHaveLength(1);
  });

  test("the daily clean-up removes old bills and remembers their codes", async () => {
    await wipe();
    await createBill("K7QM3XPH", trip);
    await createBill("K7QM3XPJ", trip);
    await must(database.from("bills").update({ expires_at: NEVER }).eq("id", "K7QM3XPH"));
    await must(database.from("payments").insert({ ...paymentRow("n", "h", 100), bill_id: "K7QM3XPH" }));
    await must(database.from("expired_bills").insert({ id: "K7QM3XPK", expired_at: NEVER }));
    await must(database.rpc("delete_old_bills"));
    const after = await getDb();
    expect(after.bills.map((b) => b.id)).toEqual(["K7QM3XPJ"]);
    expect(after.payments).toHaveLength(0);
    expect(after.expired_bills.map((e) => e.id)).toEqual(["K7QM3XPH"]);
  });

  test("gives the public key nothing", async () => {
    await must(database.from("expired_bills").insert({ id: "K7QM3XPH" }));
    const anon = createClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const table of TABLES) {
      const { data, error } = await anon.from(table).select("*");
      expect(error, table).not.toBeNull();
      expect(data, table).toBeNull();
    }
    for (const name of FUNCTIONS) {
      const { error } = await anon.rpc(name, {});
      expect(error, name).not.toBeNull();
      expect(error!.code, name).not.toBe("23505");
    }
    const { error } = await anon.rpc("save_bill", {
      p_id: BILL,
      p_version: 0,
      p_bill: {},
      p_people: [],
      p_items: [],
      p_shares: [],
      p_events: [],
    });
    expect(error?.code).toBe("42501");
    expect((await getDb()).bills).toHaveLength(1);
  });
});

test("a change on one phone shows on another without reloading", async ({ browser }) => {
  await seed();
  const mine = await newPhone(browser);
  const other = await newPhone(browser);
  await openBill(mine);
  await openBill(other);
  await expect(text(other, "HOTEL")).toBeVisible();
  await submit(await startAdding(mine, "Snacks", "1000", "Najmi"));
  await expect(text(other, "SNACKS")).toBeVisible();
});

test.describe("the browser key", () => {
  test.beforeEach(() => seed());

  test("is hidden from the page and stored only as a hash", async ({ page, context }) => {
    await openBill(page);
    await submit(await startAdding(page, "Snacks", "1000", "Najmi"));
    await expect(text(page, "SNACKS")).toBeVisible();
    const cookie = (await context.cookies()).find((c) => c.name === "splitin-browser")!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    expect(await page.evaluate(() => document.cookie)).not.toContain("splitin-browser");

    const { rights } = (await getDb()).bills[0];
    const hash = Object.values(rights.items!)[0];
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(cookie.value);
    expect(await page.content()).not.toContain(hash);
  });

  test("keeps a member's rights after local storage is cleared", async ({ page }) => {
    await openBill(page);
    await submit(await startAdding(page, "Snacks", "1000", "Najmi"));
    await expect(text(page, "SNACKS")).toBeVisible();
    await page.evaluate(() => localStorage.clear());
    await page.goto(`/bill/${BILL}`);
    await button(page, "Delete").click();
    await pickMe(page, "Najmi");
    await expect.poll(async () => (await serverDoc()).items.map((i) => i.name)).toEqual(["Hotel"]);
  });

  test("the server refuses a delete from a different browser", async ({ page, context }) => {
    await openBill(page);
    await submit(await startAdding(page, "Snacks", "1000", "Najmi"));
    await expect(text(page, "SNACKS")).toBeVisible();
    await page.reload();
    await expect(button(page, "Delete")).toBeVisible();
    await context.addCookies([{ name: "splitin-browser", value: "another", url: "http://localhost:3457" }]);
    await button(page, "Delete").click();
    await expect(text(page, "Something went wrong")).toBeVisible();
    expect((await serverDoc()).items.map((i) => i.name)).toEqual(["Hotel", "Snacks"]);
  });

  test("a phone that lost local storage is still the owner, without an owner link to copy", async ({ browser }) => {
    const owner = await newPhone(browser, { "splitin:draft:v2": { doc: trip, billId: null, seenAt: "" } });
    await owner.goto("/");
    await button(owner, "Share receipt").click();
    await expect(sheet(owner).getByText("Copy link")).toBeVisible();
    const id = (await getDb()).bills.find((b) => b.id !== BILL)!.id;

    await owner.evaluate(() => localStorage.clear());
    await owner.goto(`/bill/${id}`);
    await expect(text(owner, "Hi Haziq")).toBeVisible();
    await owner.getByRole("button", { name: "More", exact: true }).click();
    await expect(sheet(owner).getByRole("button", { name: /Lock/ })).toBeVisible();
    await expect(sheet(owner).getByRole("button", { name: "Copy owner link" })).toHaveCount(0);

    await sheet(owner).getByRole("button", { name: /Lock/ }).click();
    await expect.poll(async () => (await getDb()).bills.find((b) => b.id === id)?.doc.locked).toBe(true);

    await button(owner, "Edit bills").click();
    await expect(owner).toHaveURL(/\/$/);
    await owner.evaluate(() => {
      const draft = JSON.parse(localStorage.getItem("splitin:draft:v2")!);
      draft.doc.title = "Renamed";
      localStorage.setItem("splitin:draft:v2", JSON.stringify(draft));
      window.dispatchEvent(new Event("storage"));
    });
    await expect.poll(async () => (await getDb()).bills.find((b) => b.id === id)?.doc.title).toBe("Renamed");
  });

  test("a phone holding the owner link can still copy it", async ({ browser }) => {
    const owner = await newPhone(browser, ownerStorage());
    await owner.goto(`/bill/${BILL}`);
    await expect(text(owner, "Hi Haziq")).toBeVisible();
    await owner.getByRole("button", { name: "More", exact: true }).click();
    await expect(sheet(owner).getByRole("button", { name: "Copy owner link" })).toBeVisible();
  });
});
