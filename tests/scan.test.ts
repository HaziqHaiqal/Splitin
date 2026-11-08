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

const row = (form: Locator, line: string) =>
  form.getByRole("button", { name: new RegExp(`^${line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},`) });
const back = (form: Locator) => form.getByRole("button", { name: "Back", exact: true });
const pays = (form: Locator, name: string) =>
  form
    .getByRole("list", { name: "Each person pays" })
    .getByRole("listitem")
    .filter({ hasText: name })
    .locator(":scope > :last-child");

async function tapWho(form: Locator, line: string, name: string) {
  const group = form.getByRole("radiogroup", { name: line, exact: true });
  await expect(group.or(row(form, line)).or(back(form)).first()).toBeVisible();
  if (!(await group.isVisible())) {
    if (!(await row(form, line).isVisible())) await back(form).click();
    await row(form, line).click();
  }
  await group.getByRole("radio", { name, exact: true }).click();
}

const added = async () => {
  const item = (await serverDoc()).items.find((i) => i.name === "Restoran Ali");
  return item && { amountMinor: item.amountMinor, charges: item.charges, overrides: item.overrides };
};

test.afterEach(() => closePhones());

test("a scanned receipt fills in the bill and keeps its exact total", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  await expect(form.getByText("Receipt attached")).toBeVisible();
  await expect(form.getByText("3 items · RM 46.65")).toBeVisible();
  await expect(form.getByText("Scan a receipt")).toHaveCount(0);
  await expect(form.getByRole("textbox", { name: "What for" })).toHaveValue("Restoran Ali");
  await expect(form.getByRole("textbox", { name: "Amount (RM)" })).toHaveValue("40.00");
  await expect(form.getByRole("textbox", { name: "Amount (RM)" })).not.toBeEditable();
  for (const name of ["Haziq", "Najmi", "Afiq"]) await expect(pays(form, name)).toHaveText("15.55");
  await expect(form.getByText("Tap an item to say whose it is.")).toBeVisible();
  await expect(row(form, "Teh ais")).toHaveAccessibleName("Teh ais, Shared by everyone, 6.00");
  await expect(row(form, "Teh ais")).toContainText("2.00 each");
  await expect(form.getByText("Split equally", { exact: false })).toHaveCount(0);
  await expect(form.getByText("Service charge and SST are split by what each person had.")).toBeVisible();
  await expect(form.getByRole("checkbox", { name: "Service charge" })).toBeChecked();
  await expect(form.getByRole("checkbox", { name: "SST" })).toBeChecked();
  await expect(form.getByText("RM 46.65", { exact: true })).toBeVisible();
  await expect(form.getByText("The receipt says", { exact: false })).toHaveCount(0);
  await submit(form);
  await settled(added, {
    amountMinor: 4665,
    charges: { subtotalMinor: 4000, serviceBp: 1000, taxBp: 600 },
    overrides: {},
  });
  await expect(text(page, "INCL. SERVICE 10% · SST 6%")).toBeVisible();
});

test("tapping who had what sets each person's part", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  await tapWho(form, "2 × Nasi lemak", "Haziq");
  await expect(form.getByRole("radiogroup", { name: "Teh ais" })).toBeVisible();
  await tapWho(form, "Teh ais", "Najmi");
  await back(form).click();
  await expect(form.getByText("2 of 3 items have a name.")).toBeVisible();
  await expect(pays(form, "Haziq")).toHaveText("31.89");
  await expect(pays(form, "Najmi")).toHaveText("10.88");
  await expect(pays(form, "Afiq")).toHaveText("3.88");
  await expect(form.getByText("27.34 + 4.55 service & SST")).toBeVisible();
  await expect(form.getByText("Reset to equal")).toHaveCount(0);
  await submit(form);
  await settled(added, {
    amountMinor: 4665,
    charges: { subtotalMinor: 4000, serviceBp: 1000, taxBp: 600 },
    overrides: { h: 2734, n: 933, a: 333 },
  });
});

test("the next item comes up by itself, Skip moves on, and the last one goes back to the list", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  await row(form, "2 × Nasi lemak").click();
  await expect(form.getByRole("heading", { name: "Who had it?" })).toBeVisible();
  await expect(form.getByText("Item 1 of 3")).toBeVisible();
  await form.getByRole("radiogroup", { name: "2 × Nasi lemak" }).getByRole("radio", { name: "Haziq", exact: true }).click();
  await expect(form.getByText("Item 2 of 3")).toBeVisible();
  await form.getByRole("button", { name: /^Skip/ }).click();
  await expect(form.getByText("Item 3 of 3")).toBeVisible();
  await expect(form.getByRole("button", { name: /^Skip/ })).toHaveCount(0);
  await form.getByRole("radiogroup", { name: "Roti canai" }).getByRole("radio", { name: "Afiq", exact: true }).click();
  await expect(form.getByText("2 of 3 items have a name.")).toBeVisible();
  await expect(row(form, "2 × Nasi lemak")).toHaveAccessibleName("2 × Nasi lemak, Haziq, 24.00");
  await expect(row(form, "Teh ais")).toHaveAccessibleName("Teh ais, Shared by everyone, 6.00");
});

test("more than one person can have an item, and Everyone shares it puts it back", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  await row(form, "Teh ais").click();
  await form.getByRole("button", { name: "More than one person had it" }).click();
  const group = form.getByRole("group", { name: "Teh ais" });
  await group.getByRole("checkbox", { name: "Haziq", exact: true }).click();
  await group.getByRole("checkbox", { name: "Najmi", exact: true }).click();
  await form.getByRole("button", { name: /^Next item/ }).click();
  await expect(form.getByRole("radiogroup", { name: "Roti canai" })).toBeVisible();
  await back(form).click();
  await expect(row(form, "Teh ais")).toHaveAccessibleName("Teh ais, Haziq and Najmi, 6.00");
  await expect(row(form, "Teh ais")).toContainText("3.00 each");
  await row(form, "Teh ais").click();
  await expect(form.getByRole("group", { name: "Teh ais" }).getByRole("checkbox", { checked: true })).toHaveCount(2);
  await form.getByRole("button", { name: "Just one person" }).click();
  await form.getByRole("radiogroup", { name: "Teh ais" }).getByRole("radio", { name: /^Everyone shares it/ }).click();
  await back(form).click();
  await expect(row(form, "Teh ais")).toHaveAccessibleName("Teh ais, Shared by everyone, 6.00");
  for (const name of ["Haziq", "Najmi", "Afiq"]) await expect(pays(form, name)).toHaveText("15.55");
});

test("what has no name can be shared by fewer people", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  await form.getByRole("button", { name: "Change" }).click();
  await form
    .getByRole("group", { name: "Who shares the rest" })
    .getByRole("checkbox", { name: "Afiq", exact: true })
    .click();
  await expect(form.getByText("Anything without a name is shared by Haziq and Najmi.")).toBeVisible();
  await expect(row(form, "Teh ais")).toHaveAccessibleName("Teh ais, Shared by 2 people, 6.00");
  await expect(pays(form, "Afiq")).toHaveText("0.00");
  await tapWho(form, "Roti canai", "Afiq");
  await expect(pays(form, "Afiq")).toHaveText("11.66");
  await submit(form);
  await settled(
    async () => (await serverDoc()).items.find((i) => i.name === "Restoran Ali")?.participants,
    ["h", "n", "a"],
  );
});

test("fixing a price on a line changes the amount and the total", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  await row(form, "Teh ais").click();
  await form.getByRole("button", { name: "Fix price" }).click();
  const line = form.getByRole("textbox", { name: "Teh ais's amount" });
  await line.fill("");
  await line.pressSequentially("700");
  await back(form).click();
  await expect(row(form, "Teh ais")).toHaveAccessibleName("Teh ais, Shared by everyone, 7.00");
  await expect(form.getByRole("textbox", { name: "Amount (RM)" })).toHaveValue("41.00");
  await expect(form.getByText("RM 47.81", { exact: true })).toBeVisible();
});

test("a total that doesn't add up is pointed out", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: { ...scanned, totalMinor: 5000 } });
  await expect(
    form.getByText("The receipt says RM 50.00, but the prices and charges add up to RM 46.64. Check them."),
  ).toBeVisible();
  await expect(form.getByText("RM 50.00", { exact: true })).toBeVisible();
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
  await back(form).click();
  await form.getByRole("button", { name: "Remove the receipt" }).click();
  await expect(form.getByText("Scan a receipt")).toBeVisible();
  await expect(form.getByRole("textbox", { name: "What for" })).toHaveValue("");
  await expect(form.getByRole("textbox", { name: "Amount (RM)" })).toHaveValue("");
  await expect(form.getByText("Who had what?")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(form.getByText("Receipt attached")).toBeVisible();
  await expect(form.getByRole("textbox", { name: "Amount (RM)" })).toHaveValue("40.00");
  await expect(row(form, "Teh ais")).toHaveAccessibleName("Teh ais, Najmi, 6.00");
});

test("a receipt with SST already in its prices says so and adds nothing", async ({ page }) => {
  await seed();
  await openBill(page);
  const inclusive = { ...scanned, serviceBp: undefined, taxBp: undefined, includedTaxBp: 600, totalMinor: 4000 };
  const form = await scanReceipt(page, { ok: true, data: inclusive });
  await expect(form.getByText("SST 6% is already in the prices")).toBeVisible();
  await expect(form.getByText("3 items · RM 40.00")).toBeVisible();
  await expect(form.getByRole("checkbox", { name: "SST" })).toHaveCount(0);
  await expect(form.getByText("Nothing is added on top: SST is already in the prices.")).toBeVisible();
  await expect(form.getByText("includes 0.75 SST").first()).toBeVisible();
});

test("a receipt with no charges says so", async ({ page }) => {
  await seed();
  await openBill(page);
  const plain = { ...scanned, serviceBp: undefined, taxBp: undefined, totalMinor: 4000 };
  const form = await scanReceipt(page, { ok: true, data: plain });
  await expect(form.getByText("No SST or service charge on this receipt.")).toBeVisible();
  await tapWho(form, "Roti canai", "Afiq");
  await expect(pays(form, "Afiq")).toHaveText("20.00");
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
  await form.getByRole("button", { name: "See the receipt photo" }).click();
  await expect(page.getByRole("dialog").getByRole("img", { name: "Receipt" })).toBeVisible();
  await page.keyboard.press("Escape");
  await form.getByRole("textbox", { name: "What for" }).fill("Makan");
  await form.getByRole("button", { name: /Print it/ }).click();
  await expect(text(page, "HAZIQ 27.99")).toBeVisible();
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem("splitin:draft:v2") ?? "null"));
  expect(draft.doc.items[0].overrides).toEqual({ h: 2400, n: 600, a: 1000 });
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
  await expect(form.getByText("Receipt attached")).toBeVisible();
  await expect(form.getByRole("status")).toHaveCount(0);
});
