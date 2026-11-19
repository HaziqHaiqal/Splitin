import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  choose,
  closePhones,
  newPhone,
  openBill,
  panel,
  pickMe,
  seed,
  serverDoc,
  settled,
  submit,
  text,
  trip,
} from "./helpers";
import type { Scan } from "../src/lib/receipt-scan";

const scanned: Scan = {
  shop: "Restoran Ali",
  lines: [
    { name: "2 × Nasi lemak", amountMinor: 2400 },
    { name: "Teh ais", amountMinor: 600 },
    { name: "Roti canai", amountMinor: 1000 },
  ],
  subtotalMinor: 4000,
  serviceBp: 1000,
  taxBp: 600,
  totalMinor: 4665,
};

const photo = {
  name: "receipt.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
};

async function scanReceipt(page: Page, reply?: unknown) {
  if (reply) await page.route("**/api/scan", (route) => route.fulfill({ json: reply }));
  await choose(page, "Add bill");
  await pickMe(page, "Najmi");
  const form = panel(page);
  await expect(form.getByText("Scan a receipt")).toBeVisible();
  await form.getByLabel("Scan a receipt").setInputFiles(photo);
  return form;
}

const esc = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const item = (form: Locator, line: string) => form.getByRole("button", { name: new RegExp(`^${esc(line)}( |$)`) });
const who = (form: Locator, line: string) => form.getByRole("group", { name: `Who had ${line}?`, exact: true });

async function tapWho(form: Locator, line: string, name: string) {
  await expect(item(form, line)).toBeVisible();
  if (!(await who(form, line).isVisible())) await item(form, line).click();
  await who(form, line).getByRole("button", { name, exact: true }).click();
}

const payer = (form: Locator, name: string) =>
  form.getByRole("group", { name: "Who paid?" }).getByRole("button", { name, exact: true });

const ALL = scanned.lines.map((line) => line.name);

async function everyoneHad(form: Locator, ...lines: string[]) {
  for (const line of lines) for (const name of ["Haziq", "Najmi", "Afiq"]) await tapWho(form, line, name);
}

async function paidBy(form: Locator, name: string) {
  await payer(form, name).click();
}

const added = async () => {
  const item = (await serverDoc()).items.find((i) => i.name === "Restoran Ali");
  return item && { amountMinor: item.amountMinor, charges: item.charges, overrides: item.overrides };
};

test.afterEach(() => closePhones());

test("a scanned receipt shows the bill on top and who had what below, and keeps its exact total", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  await expect(form.getByText("Scanned · 3 items", { exact: true })).toBeVisible();
  await expect(form.getByText("Items", { exact: true })).toBeVisible();
  await expect(form.getByText("Service charge 10%", { exact: true })).toBeVisible();
  await expect(form.getByText("SST 6%", { exact: true })).toBeVisible();
  await expect(form.getByText("RM 2.64", { exact: true })).toBeVisible();
  await expect(form.getByText("Split by what each person had")).toBeVisible();
  await expect(form.getByText("Split equally between who had something")).toBeVisible();
  await expect(form.getByText("Scan a receipt")).toHaveCount(0);
  await expect(form.getByRole("textbox", { name: "What for" })).toHaveValue("Restoran Ali");
  await expect(form.locator("button[type=submit]")).toHaveText("Pick who paid");
  await paidBy(form, "Najmi");
  await expect(payer(form, "Najmi")).toHaveAttribute("aria-pressed", "true");
  await expect(form.getByRole("textbox", { name: "Total paid" })).toHaveValue("46.65");
  await expect(form.getByRole("heading", { name: "Who had what?" })).toBeVisible();
  await expect(item(form, "Teh ais")).toHaveAccessibleName("Teh ais Not picked yet 6.00");
  await expect(form.locator("button[type=submit]")).toHaveText("Pick who had 3 more");
  await form.locator("button[type=submit]").click();
  await expect(who(form, "2 × Nasi lemak").getByRole("button", { name: "Everyone" })).toHaveCount(0);
  await expect(who(form, "2 × Nasi lemak").getByRole("button", { pressed: true })).toHaveCount(0);
  await everyoneHad(form, ...ALL);
  await expect(item(form, "Teh ais")).toHaveAccessibleName("Teh ais Everyone 6.00");
  await expect(form.getByRole("textbox", { name: "Amount (RM)" })).toHaveCount(0);
  await expect(form.getByRole("checkbox", { name: "Service charge" })).toHaveCount(0);
  await submit(form);
  await settled(added, {
    amountMinor: 4665,
    charges: { subtotalMinor: 4000, serviceBp: 1000, taxBp: 600 },
    overrides: {},
  });
  await expect(text(page, "INCL. SERVICE 10% · SST 6%")).toBeVisible();
});

test("an item's discount shows on that item and goes only to whoever had it", async ({ page }) => {
  await seed();
  await openBill(page);
  const discounted: Scan = {
    ...scanned,
    lines: [{ name: "2 × Nasi lemak", amountMinor: 2000, offMinor: 400 }, ...scanned.lines.slice(1)],
    subtotalMinor: 3600,
    offMinor: 400,
    totalMinor: 4198,
  };
  const form = await scanReceipt(page, { ok: true, data: discounted });
  await expect(form.getByText("Scanned · 3 items · RM 4.00 discount taken off")).toBeVisible();
  await expect(form.getByText("RM 4.00 discount, only for whoever had it")).toBeVisible();
  await expect(form.getByRole("button", { name: "Price of 2 × Nasi lemak" })).toHaveText(/24\.00\s*20\.00/);
  await tapWho(form, "2 × Nasi lemak", "Haziq");
  await item(form, "2 × Nasi lemak").click();
  await expect(item(form, "2 × Nasi lemak")).toHaveAccessibleName("2 × Nasi lemak Haziq · 4.00 off 24.00 20.00");
});

test("tapping who had what sets each person's part", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  await tapWho(form, "2 × Nasi lemak", "Haziq");
  await tapWho(form, "Teh ais", "Najmi");
  await expect(who(form, "2 × Nasi lemak")).toHaveCount(0);
  await expect(item(form, "2 × Nasi lemak")).toHaveAccessibleName("2 × Nasi lemak Haziq 24.00");
  await everyoneHad(form, "Roti canai");
  await paidBy(form, "Najmi");
  await submit(form);
  await settled(added, {
    amountMinor: 4665,
    charges: { subtotalMinor: 4000, serviceBp: 1000, taxBp: 600 },
    overrides: { h: 2734, n: 933, a: 333 },
  });
});

test("a printed scan opens again as the same list, with its photo, and can be changed", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  await tapWho(form, "2 × Nasi lemak", "Haziq");
  await tapWho(form, "Teh ais", "Najmi");
  await everyoneHad(form, "Roti canai");
  await paidBy(form, "Najmi");
  await submit(form);
  await settled(async () => (await added())?.overrides, { h: 2734, n: 933, a: 333 });

  await choose(page, "Your bills");
  await panel(page)
    .getByRole("button", { name: /Restoran Ali/ })
    .first()
    .click();
  const again = panel(page);
  await expect(again.getByText("Scanned · 3 items")).toBeVisible();
  await expect(again.getByRole("textbox", { name: "What for" })).toHaveValue("Restoran Ali");
  await expect(payer(again, "Najmi")).toHaveAttribute("aria-pressed", "true");
  await expect(item(again, "2 × Nasi lemak")).toHaveAccessibleName("2 × Nasi lemak Haziq 24.00");
  await expect(item(again, "Roti canai")).toHaveAccessibleName("Roti canai Everyone 10.00");
  await expect(again.getByRole("button", { name: "See the receipt photo" })).toBeEnabled();
  await tapWho(again, "Roti canai", "Haziq");
  await tapWho(again, "Roti canai", "Najmi");
  await again.getByRole("button", { name: "Save", exact: true }).click();
  await settled(async () => (await added())?.overrides, { h: 2400, n: 600, a: 1000 });
});

test("the arrows on the line move between items, and tapping the open item closes it", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  const prev = form.getByRole("button", { name: "Previous item" });
  const next = form.getByRole("button", { name: "Next item" });
  await expect(prev).toBeDisabled();
  await next.click();
  await expect(who(form, "Teh ais")).toBeVisible();
  await expect(who(form, "2 × Nasi lemak")).toHaveCount(0);
  await next.click();
  await expect(who(form, "Roti canai")).toBeVisible();
  await expect(next).toBeDisabled();
  await prev.click();
  await expect(who(form, "Teh ais")).toBeVisible();
  await expect(form.getByText("2 of 3")).toBeVisible();
  await item(form, "Teh ais").click();
  await expect(form.getByRole("group", { name: /^Who had/ })).toHaveCount(0);
  await expect(next).toHaveCount(0);
  await item(form, "2 × Nasi lemak").click();
  await expect(who(form, "2 × Nasi lemak")).toBeVisible();
  await expect(prev).toBeDisabled();
});

test("more than one person can have an item, and tapping a name again takes them off", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  await tapWho(form, "Teh ais", "Haziq");
  await tapWho(form, "Teh ais", "Najmi");
  await expect(who(form, "Teh ais").getByRole("button", { pressed: true })).toHaveCount(2);
  await item(form, "Teh ais").click();
  await expect(item(form, "Teh ais")).toHaveAccessibleName("Teh ais Haziq and Najmi 6.00");
  await tapWho(form, "Teh ais", "Najmi");
  await expect(who(form, "Teh ais").getByRole("button", { pressed: true })).toHaveText(/Haziq/);
  await everyoneHad(form, "2 × Nasi lemak", "Roti canai");
  await paidBy(form, "Najmi");
  await submit(form);
  await settled(async () => (await added())?.amountMinor, 4665);
});

test("someone new can be added right on an item", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  await who(form, "2 × Nasi lemak").getByRole("button", { name: "+ New person" }).click();
  await form.getByRole("textbox", { name: "Add person" }).fill("Mei");
  await form.getByRole("textbox", { name: "Add person" }).press("Enter");
  await expect(who(form, "2 × Nasi lemak").getByRole("button", { name: "Mei", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("paying less than the receipt, like with a ShopeePay deal, shares the saving out", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  const total = form.getByRole("textbox", { name: "Total paid" });
  await total.fill("");
  await total.pressSequentially("3500");
  await total.press("Enter");
  await expect(form.getByRole("textbox", { name: "Total paid" })).toHaveValue("35.00");
  await expect(form.getByText("RM 11.65 off at payment · everyone pays 25% less")).toBeVisible();
  await everyoneHad(form, ...ALL);
  await paidBy(form, "Najmi");
  await submit(form);
  await settled(added, { amountMinor: 3500, charges: { subtotalMinor: 4000 }, overrides: {} });
});

test("Print it points to what's missing: what it's for, then who paid", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: { ...scanned, shop: "" } });
  const name = form.getByRole("textbox", { name: "What for" });
  const print = form.locator("button[type=submit]");
  await expect(print).toHaveText("Add what it's for");
  await print.click();
  await expect(name).toBeFocused();
  await name.fill("Lunch");
  await expect(print).toHaveText("Pick who paid");
  await print.click();
  await paidBy(form, "Najmi");
  await paidBy(form, "Afiq");
  await expect(payer(form, "Afiq")).toHaveAttribute("aria-pressed", "true");
  await expect(payer(form, "Najmi")).toHaveAttribute("aria-pressed", "false");
  await expect(print).toHaveText("Pick who had 3 more");
  await print.click();
  await expect(who(form, "2 × Nasi lemak")).toBeVisible();
  await everyoneHad(form, ...ALL);
  await expect(print).toHaveText(/^Print it/);
});

test("fixing a price keeps the total paid", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  await item(form, "Teh ais").click();
  await form.getByRole("button", { name: "Price of Teh ais" }).click();
  const price = form.getByRole("textbox", { name: "Price of Teh ais" });
  await price.fill("");
  await price.pressSequentially("700");
  await price.press("Enter");
  await expect(form.getByRole("button", { name: "Price of Teh ais" })).toHaveText(/7\.00/);
  await expect(form.getByRole("textbox", { name: "Total paid" })).toHaveValue("46.65");
  await everyoneHad(form, ...ALL);
  await paidBy(form, "Najmi");
  await submit(form);
  await settled(added, { amountMinor: 4665, charges: { subtotalMinor: 4100 }, overrides: {} });
});

test("a receipt with only a total fills in the form, and a total that doesn't add up is pointed out", async ({
  page,
}) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: { ...scanned, lines: [], totalMinor: 5000 } });
  await expect(form.getByText("Receipt attached")).toBeVisible();
  await expect(form.getByRole("textbox", { name: "Amount (RM)" })).toHaveValue("40.00");
  await expect(
    form.getByText("The receipt says RM 50.00, but the prices and charges add up to RM 46.64. Check them."),
  ).toBeVisible();
  await expect(form.getByText("RM 50.00", { exact: true }).first()).toBeVisible();
});

test("a scan that fails says why and leaves the form as it was", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: false, error: "busy" });
  await expect(form.getByRole("alert")).toHaveText(
    "Scanning is unavailable right now. Try again in a few minutes, or type it in.",
  );
  await expect(form.getByRole("textbox", { name: "What for" })).toHaveValue("");
  await expect(form.getByText("Scan a receipt")).toBeVisible();
});

test("without a Gemini key, scanning says it's unavailable", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page);
  await expect(form.getByRole("alert")).toHaveText(
    "Scanning is unavailable right now. Try again in a few minutes, or type it in.",
  );
});

test("with no internet, scanning says you're offline", async ({ page }) => {
  await seed();
  await openBill(page);
  await page.route("**/api/scan", (route) => route.abort("internetdisconnected"));
  const form = await scanReceipt(page);
  await expect(form.getByRole("alert")).toHaveText("You're offline. Check your internet connection and try again.");
});

test("removing the receipt clears what it filled in, and Undo brings it back", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  await tapWho(form, "Teh ais", "Najmi");
  await form.getByRole("button", { name: "Remove the receipt" }).click();
  await expect(form.getByText("Scan a receipt")).toBeVisible();
  await expect(form.getByRole("textbox", { name: "What for" })).toHaveValue("");
  await expect(form.getByRole("textbox", { name: "Amount (RM)" })).toHaveValue("");
  await expect(form.getByText("Who had what?")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(form.getByText("Scanned · 3 items")).toBeVisible();
  await item(form, "Teh ais").click();
  await expect(item(form, "Teh ais")).toHaveAccessibleName("Teh ais Najmi 6.00");
});

test("a receipt with SST already in its prices says so and adds nothing", async ({ page }) => {
  await seed();
  await openBill(page);
  const inclusive = { ...scanned, serviceBp: undefined, taxBp: undefined, includedTaxBp: 600, totalMinor: 4000 };
  const form = await scanReceipt(page, { ok: true, data: inclusive });
  await expect(form.getByText("Scanned · 3 items · SST 6% is already in the prices")).toBeVisible();
  await expect(form.getByRole("textbox", { name: "Total paid" })).toHaveValue("40.00");
  await tapWho(form, "Roti canai", "Afiq");
  await everyoneHad(form, "2 × Nasi lemak", "Teh ais");
  await paidBy(form, "Najmi");
  await submit(form);
  await settled(async () => (await added())?.overrides, { h: 1000, n: 1000, a: 2000 });
});

test("on the home page, each person's part from the receipt is what prints", async ({ browser }) => {
  const page = await newPhone(browser, { "splitin:draft:v2": { doc: { ...trip, items: [] }, billId: null } });
  await page.route("**/api/scan", (route) => route.fulfill({ json: { ok: true, data: { ...scanned, shop: "" } } }));
  await page.goto("/");
  const form = panel(page);
  await form.getByLabel("Scan a receipt").setInputFiles(photo);
  await tapWho(form, "2 × Nasi lemak", "Haziq");
  await tapWho(form, "Teh ais", "Najmi");
  await tapWho(form, "Roti canai", "Afiq");
  await expect(form.getByText("Split equally · RM 0.88 each")).toBeVisible();
  await form.getByRole("button", { name: "See the receipt photo" }).click();
  await expect(page.getByRole("dialog").getByRole("img", { name: "Receipt" })).toBeVisible();
  await page.keyboard.press("Escape");
  await form.getByRole("textbox", { name: "What for" }).fill("Makan");
  await paidBy(form, "Haziq");
  await form.getByRole("button", { name: /Print it/ }).click();
  await expect(text(page, "HAZIQ 27.29")).toBeVisible();
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem("splitin:draft:v2") ?? "null"));
  expect(draft.doc.items[0].overrides).toEqual({ h: 2400, n: 600, a: 1000 });
});

test("SST inside the prices shows the prices as printed, and what each person pays with their equal tax", async ({
  page,
}) => {
  await seed();
  await openBill(page);
  const inside: Scan = {
    shop: "Kapitan",
    lines: [
      { name: "Apple Juice", amountMinor: 802, printedMinor: 850 },
      { name: "Milani Lamb Briyani", amountMinor: 2830, printedMinor: 3000 },
      { name: "3 × Ice Water @1.00", amountMinor: 283, printedMinor: 300 },
      { name: "Bendi", amountMinor: 5377, printedMinor: 5700 },
    ],
    subtotalMinor: 9292,
    taxBp: 600,
    taxLabel: "Inclusive Service Tax",
    totalMinor: 9850,
  };
  const form = await scanReceipt(page, { ok: true, data: inside });
  await expect(form.getByText("Before tax", { exact: true })).toBeVisible();
  await expect(form.getByRole("button", { name: "Price of Apple Juice" })).toContainText("8.50");
  await expect(item(form, "3 × Ice Water @1.00")).toContainText("3.00");
  await expect(form.getByText("Each person pays")).toHaveCount(0);
  await tapWho(form, "Apple Juice", "Afiq");
  await tapWho(form, "Milani Lamb Briyani", "Haziq");
  await tapWho(form, "3 × Ice Water @1.00", "Najmi");
  await tapWho(form, "Bendi", "Najmi");
  await expect(form.getByText("Each person pays")).toBeVisible();
  await expect(form.getByText("8.02 + 1.86 tax")).toBeVisible();
  await expect(form.getByText("28.30 + 1.86 tax")).toBeVisible();
  await expect(form.getByText("56.60 + 1.86 tax")).toBeVisible();
});

test("while it reads, the photo shows with the steps", async ({ page }) => {
  await seed();
  await openBill(page);
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/scan", async (route) => {
    await held;
    await route.fulfill({ json: { ok: true, data: scanned } });
  });
  const form = await scanReceipt(page);
  const status = form.getByRole("status");
  await expect(status.getByText("Reading the receipt…")).toBeVisible();
  await expect(status.getByText("Finding the items")).toBeVisible();
  await expect(status.locator("img")).toHaveCount(1);
  await expect(status.getByText("Reading the prices")).toBeVisible();
  await page.screenshot({ path: "test-results/reading.png" });
  release();
  await expect(form.getByText("Scanned · 3 items")).toBeVisible();
  await expect(form.getByRole("status")).toHaveCount(0);
});
