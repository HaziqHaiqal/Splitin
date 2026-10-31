import { createHash } from "node:crypto";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { BillDoc, Item, Payment } from "../src/lib/bill";

const STUB = "http://localhost:54399";
export const BILL = "TestBill01";
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
  bills: (Row & { doc: BillDoc })[];
  payments: Row[];
  bill_events: (Row & { kind: string; actor: string; data: Row })[];
  expired_bills: Row[];
};

export const paymentRow = (from: string, to: string, amountMinor: number, marked_by = "payer") => ({
  id: crypto.randomUUID(),
  bill_id: BILL,
  from_person: from,
  to_person: to,
  amount_minor: amountMinor,
  marked_by,
  created_at: new Date().toISOString(),
});

export async function seed(doc: BillDoc = trip, rest: { payments?: Row[]; bill_events?: Row[] | null } = {}) {
  const now = new Date().toISOString();
  await fetch(`${STUB}/__db`, {
    method: "POST",
    body: JSON.stringify({
      bills: [
        {
          id: BILL,
          doc,
          owner_token_hash: createHash("sha256").update(TOKEN).digest("hex"),
          created_at: now,
          updated_at: OLD,
        },
      ],
      ...rest,
    }),
  });
}

export const getDb = async (): Promise<Db> => (await fetch(`${STUB}/__db`)).json();
export const saveDb = (db: Partial<Db>) => fetch(`${STUB}/__db`, { method: "POST", body: JSON.stringify(db) });
export const serverDoc = async () => (await getDb()).bills[0].doc;
export const serverItem = async (id: string) => (await serverDoc()).items.find((i) => i.id === id);
export const eventKinds = async () => (await getDb()).bill_events?.map((e) => e.kind) ?? [];
export const collide = () => fetch(`${STUB}/__collide`);

export async function patchDoc(change: (doc: BillDoc) => BillDoc) {
  const db = await getDb();
  db.bills[0].doc = change(db.bills[0].doc);
  db.bills[0].updated_at = new Date().toISOString();
  await saveDb(db);
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

export const panel = (page: Page) => page.locator('[class*="rounded-t-[22px]"]');
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

export async function choose(page: Page, option: "Add bill" | "Join bill") {
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  await button(page, option).click();
}

export async function fromMore(page: Page, option: string) {
  await page.getByRole("button", { name: "More", exact: true }).click();
  await sheet(page).getByRole("button", { name: option }).click();
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

export async function openJoin(page: Page, me?: string) {
  await choose(page, "Join bill");
  if (me) await pickMe(page, me);
  const form = panel(page);
  await expect(form.getByText("Which bills are you in?")).toBeVisible();
  return form;
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
  await button(page, /^History/).click();
  const list = sheet(page);
  await expect(list.getByRole("heading", { name: "History" })).toBeVisible();
  return list;
}
