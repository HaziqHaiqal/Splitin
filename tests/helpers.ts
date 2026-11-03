import { createHash } from "node:crypto";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { BillDoc, BillRights, Item, Payment } from "../src/lib/bill";
import { BILL_COLUMNS, docFromRow, rightsFromRow, saveArgs, type BillRow } from "../src/lib/bill-rows";

export const database = createClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_SERVICE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
export const BILL = "TE5TB4RS";
export const TOKEN = "ownertokenownertoken1234";
export const OLD = "2026-10-31T01:00:00.000Z";

const everyone = ["h", "n", "a"];
export const hotel: Item = {
  id: "hotel",
  name: "Hotel",
  amountMinor: 30000,
  paidBy: "h",
  participants: everyone,
  overrides: {},
};
export const dinner: Item = {
  id: "dinner",
  name: "Dinner",
  amountMinor: 9000,
  paidBy: "a",
  participants: everyone,
  overrides: {},
};
export const trip: BillDoc = {
  title: "Trip",
  currency: "MYR",
  createdAt: OLD,
  ownerId: "h",
  people: [
    { id: "h", name: "Haziq", color: 0 },
    { id: "n", name: "Najmi", color: 1 },
    { id: "a", name: "Afiq", color: 2 },
  ],
  items: [hotel],
};

type Row = Record<string, unknown>;
export type Db = {
  bills: { id: string; version: number; doc: BillDoc; rights: BillRights }[];
  payments: Row[];
  bill_events: (Row & {
    kind: string;
    by_role: string;
    by_person_id: string | null;
    by_name: string | null;
    data: Row;
  })[];
  expired_bills: Row[];
};

export const paymentRow = (from: string, to: string, amountMinor: number, by_role = "member") => ({
  id: crypto.randomUUID(),
  bill_id: BILL,
  from_person: from,
  to_person: to,
  amount_minor: amountMinor,
  by_role,
  created_at: new Date().toISOString(),
});

export async function must<T>(query: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(JSON.stringify(error));
  return data;
}

export async function wipe() {
  await must(database.from("bills").delete().neq("id", ""));
  await must(database.from("expired_bills").delete().neq("id", ""));
}

export async function createBill(id: string, doc: BillDoc) {
  const { p_bill, ...rows } = saveArgs(doc, {});
  await must(
    database.rpc("create_bill", {
      p_id: id,
      p_bill: {
        ...p_bill,
        owner_token_hash: createHash("sha256").update(TOKEN).digest("hex"),
        browser_hash: null,
        ip_hash: null,
        started_at: doc.createdAt,
      },
      ...rows,
      p_events: [],
    }),
  );
}

export async function seed(doc: BillDoc = trip, rest: { payments?: Row[]; bill_events?: Row[] } = {}, id = BILL) {
  await wipe();
  await createBill(id, doc);
  if (rest.payments) await must(database.from("payments").insert(rest.payments));
  if (rest.bill_events) await must(database.from("bill_events").insert(rest.bill_events));
}

export async function markExpired(id = BILL) {
  await wipe();
  await must(database.from("expired_bills").insert({ id }));
}

export const changePayments = (change: Row) => must(database.from("payments").update(change).neq("bill_id", ""));
export const clearPayments = () => must(database.from("payments").delete().neq("bill_id", ""));

export async function getDb(): Promise<Db> {
  const [bills, payments, bill_events, expired_bills] = await Promise.all([
    must(
      database
        .from("bills")
        .select(BILL_COLUMNS)
        .order("created_at")
        .order("position", { referencedTable: "bill_people" })
        .order("position", { referencedTable: "bill_items" })
        .order("position", { referencedTable: "bill_items.item_shares" })
        .order("created_at", { referencedTable: "payments" }),
    ),
    must(database.from("payments").select("*").order("created_at")),
    must(database.from("bill_events").select("*").order("created_at")),
    must(database.from("expired_bills").select("*")),
  ]);
  return {
    bills: (bills as unknown as BillRow[]).map((row) => ({
      id: row.id,
      version: row.version,
      doc: docFromRow(row),
      rights: rightsFromRow(row),
    })),
    payments: payments ?? [],
    bill_events: bill_events ?? [],
    expired_bills: expired_bills ?? [],
  };
}

export const serverDoc = async () => (await getDb()).bills[0].doc;

export const CODE = "K7QM3XPH";
export const seedWithCode = () => seed(trip, {}, CODE);
export const serverItem = async (id: string) => (await serverDoc()).items.find((i) => i.id === id);
export const eventKinds = async () => (await getDb()).bill_events?.map((e) => e.kind) ?? [];

export async function patchDoc(change: (doc: BillDoc) => BillDoc) {
  const { id, version, doc, rights } = (await getDb()).bills[0];
  await must(
    database.rpc("save_bill", { p_id: id, p_version: version, ...saveArgs(change(doc), rights), p_events: [] }),
  );
}

export const settled = (check: () => Promise<unknown>, expected: unknown) => expect.poll(check).toEqual(expected);

const phones: BrowserContext[] = [];

export async function closePhones() {
  await Promise.all(phones.splice(0).map((phone) => phone.close()));
}

export async function newPhone(browser: Browser, storage: Record<string, unknown> = {}) {
  const context = await browser.newContext();
  phones.push(context);
  await context.addInitScript((items) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    for (const [key, value] of Object.entries(items))
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  }, storage);
  return context.newPage();
}

export const ownerStorage = (doc: BillDoc = trip, seenAt = "") => ({
  [`splitin:owner:${BILL}`]: TOKEN,
  "splitin:draft:v2": { doc, billId: BILL, seenAt },
});

export const openFresh = (page: Page) => page.goto(`/bill/${BILL}`);

export async function openBill(page: Page) {
  await page.addInitScript((id) => localStorage.setItem(`splitin:asked:${id}`, "1"), BILL);
  await openFresh(page);
}

export async function openAs(page: Page, name: string) {
  await openFresh(page);
  await pickMe(page, name);
  await expect(sheet(page)).toHaveCount(0);
}

export const panel = (page: Page) => page.locator('[class*="rounded-t-[22px]"], [data-panel]');
export const sheet = (page: Page) => page.getByRole("dialog");
export const button = (page: Page, name: string | RegExp) => page.getByRole("button", { name });
export const text = (page: Page, value: string | RegExp) => page.getByText(value).first();

export async function pickMe(page: Page, name: string) {
  await expect(sheet(page).getByRole("heading", { name: "Who are you?" })).toBeVisible();
  await sheet(page).getByRole("button", { name }).click();
}

export async function addName(page: Page, name: string) {
  await pickMe(page, "Not on the list");
  const form = panel(page);
  await expect(form.getByText("What's your name?")).toBeVisible();
  await form.getByPlaceholder("Name").fill(name);
  await form.getByRole("button", { name: "Add", exact: true }).click();
}

export const menuCard = (page: Page) => page.getByRole("dialog", { name: "Menu" });

export async function openMenu(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await expect(menu.or(page.getByRole("button", { name: /^Share receipt/ })).first()).toBeVisible();
  if (await menu.isVisible()) await menu.click();
}

export async function choose(page: Page, option: string) {
  await openMenu(page);
  await page.getByRole("button", { name: option, exact: true }).click();
}

export async function openBills(page: Page) {
  await openMenu(page);
  const list = page.getByRole("button", { name: /^Your bills/ });
  if (await list.isVisible()) await list.click();
}

export const billRow = (page: Page, item: string) =>
  page.locator("[data-row]").filter({ has: page.getByRole("button", { name: new RegExp(`^${item}`) }) });
export const joinButton = (page: Page, item: string) => billRow(page, item).getByRole("button", { name: /^Join/ });

export async function openBillDetail(page: Page, item: string) {
  await openBills(page);
  await page.getByRole("button", { name: new RegExp(`^${item}`) }).click();
}

export async function startAdding(page: Page, name: string, digits: string, me?: string) {
  await choose(page, "Add bill");
  if (me) await pickMe(page, me);
  const form = panel(page);
  await expect(form.getByText("Add what you paid")).toBeVisible();
  await form.locator("input[maxlength='60']").fill(name);
  await form.locator("input[inputmode='numeric']").pressSequentially(digits);
  return form;
}

export const submit = (form: ReturnType<typeof panel>) => form.locator("button[type=submit]").click();

export async function addMe(page: Page, name: string) {
  await button(page, "Who are you?").click();
  await addName(page, name);
  await expect(button(page, `Hi ${name}`)).toBeVisible();
}

export async function joinAs(page: Page, name: string, item = "Hotel") {
  await addMe(page, name);
  await openBills(page);
  await joinButton(page, item).click();
  await expect(joinButton(page, item)).toHaveCount(0);
}

export const payLine = (page: Page, from: string, to: string) =>
  page.getByRole("button", { name: new RegExp(`${from} PAYS ${to}`) });

export const paymentsOf = async (): Promise<Pick<Payment, "from" | "to" | "amountMinor">[]> =>
  (await getDb()).payments.map((p) => ({
    from: p.from_person as string,
    to: p.to_person as string,
    amountMinor: p.amount_minor as number,
  }));

export async function openHistory(page: Page) {
  await choose(page, "History");
  const list = sheet(page);
  await expect(list.getByRole("heading", { name: "History" })).toBeVisible();
  return list;
}
