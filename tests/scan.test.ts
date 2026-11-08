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

async function tapWho(form: Locator, line: string, name: string) {
  const row = form.getByRole("button", { name: line });
  if ((await row.getAttribute("aria-expanded")) !== "true") await row.click();
  await form.getByRole("group", { name: line }).getByRole("button", { name, exact: true }).click();
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
  for (const name of ["Haziq", "Najmi", "Afiq"]) await expect(form.getByText(`${name} 15.55`)).toBeVisible();
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
  await tapWho(form, "Teh ais", "Najmi");
  await expect(form.getByText("Haziq 31.89")).toBeVisible();
  await expect(form.getByText("Najmi 10.88")).toBeVisible();
  await expect(form.getByText("Afiq 3.88")).toBeVisible();
  await expect(form.getByText("Reset to equal")).toHaveCount(0);
  await submit(form);
  await settled(added, {
    amountMinor: 4665,
    charges: { subtotalMinor: 4000, serviceBp: 1000, taxBp: 600 },
    overrides: { h: 2734, n: 933, a: 333 },
  });
});

test("tapping an item opens who had it; two people halve it, and Everyone puts it back", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  await expect(form.getByRole("group", { name: "Teh ais" })).toHaveCount(0);
  await tapWho(form, "Teh ais", "Haziq");
  await tapWho(form, "Teh ais", "Najmi");
  await form.getByRole("button", { name: "Roti canai" }).click();
  await expect(form.getByRole("group", { name: "Teh ais" })).toHaveCount(0);
  await expect(form.getByRole("button", { name: /^Teh ais Haziq and Najmi 6\.00 3\.00 each/ })).toBeVisible();
  await tapWho(form, "Teh ais", "Everyone");
  await expect(form.getByRole("button", { name: /^Teh ais Everyone/ })).toBeVisible();
  for (const name of ["Haziq", "Najmi", "Afiq"]) await expect(form.getByText(`${name} 15.55`)).toBeVisible();
});

test("what nobody tapped can be shared by fewer people", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  await form.getByRole("button", { name: "Change" }).click();
  await form
    .getByRole("group", { name: "Who shares what nobody tapped" })
    .getByRole("button", { name: "Afiq" })
    .click();
  await expect(form.getByText("Anything not tapped is shared by Haziq and Najmi.")).toBeVisible();
  await expect(form.getByText("Afiq 0.00")).toBeVisible();
  await tapWho(form, "Roti canai", "Afiq");
  await expect(form.getByText("Afiq 11.66")).toBeVisible();
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
  await form.getByRole("button", { name: "Teh ais" }).click();
  const line = form.getByRole("textbox", { name: "Teh ais's amount" });
  await line.fill("");
  await line.pressSequentially("700");
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
  await form.getByRole("button", { name: "Remove the receipt" }).click();
  await expect(form.getByText("Scan a receipt")).toBeVisible();
  await expect(form.getByRole("textbox", { name: "What for" })).toHaveValue("");
  await expect(form.getByRole("textbox", { name: "Amount (RM)" })).toHaveValue("");
  await expect(form.getByText("Who had what?")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(form.getByText("Receipt attached")).toBeVisible();
  await expect(form.getByRole("textbox", { name: "Amount (RM)" })).toHaveValue("40.00");
  await expect(form.getByRole("button", { name: /^Teh ais Najmi/ })).toBeVisible();
});

test("a receipt with SST already in its prices says so and adds nothing", async ({ page }) => {
  await seed();
  await openBill(page);
  const inclusive = { ...scanned, serviceBp: undefined, taxBp: undefined, includedTaxBp: 600, totalMinor: 4000 };
  const form = await scanReceipt(page, { ok: true, data: inclusive });
  await expect(form.getByText("SST 6% is already in the prices")).toBeVisible();
  await expect(form.getByText("3 items · RM 40.00")).toBeVisible();
  await expect(form.getByRole("checkbox", { name: "SST" })).toHaveCount(0);
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
