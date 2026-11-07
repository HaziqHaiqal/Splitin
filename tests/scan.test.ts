import { expect, test, type Page } from "@playwright/test";
import { choose, closePhones, openBill, panel, pickMe, seed, serverDoc, settled, submit, text } from "./helpers";
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
  await expect(form.getByText("The photo goes to Google's AI, which may keep it.", { exact: false })).toBeVisible();
  await form.getByLabel("Scan a receipt").setInputFiles(photo);
  return form;
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
  await expect(form.getByText("Filled in from the receipt.", { exact: false })).toBeVisible();
  await expect(form.getByRole("textbox", { name: "What for" })).toHaveValue("Restoran Ali");
  await expect(form.getByRole("textbox", { name: "Amount (RM)" })).toHaveValue("40.00");
  await expect(form.getByRole("checkbox", { name: "Service charge" })).toBeChecked();
  await expect(form.getByRole("checkbox", { name: "SST" })).toBeChecked();
  await expect(form.getByText("RM 46.65")).toBeVisible();
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
  await form.getByRole("group", { name: "2 × Nasi lemak" }).getByRole("button", { name: "Haziq" }).click();
  await form.getByRole("group", { name: "Teh ais" }).getByRole("button", { name: "Najmi" }).click();
  await expect(form.getByRole("textbox", { name: "Haziq's amount" })).toHaveValue("27.34");
  await expect(form.getByRole("textbox", { name: "Afiq's amount" })).toHaveValue("3.33");
  await submit(form);
  await settled(added, {
    amountMinor: 4665,
    charges: { subtotalMinor: 4000, serviceBp: 1000, taxBp: 600 },
    overrides: { h: 2734, n: 933, a: 333 },
  });
});

test("fixing a price on a line changes the amount and the total", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page, { ok: true, data: scanned });
  const line = form.getByRole("textbox", { name: "Teh ais's amount" });
  await line.fill("");
  await line.pressSequentially("700");
  await expect(form.getByRole("textbox", { name: "Amount (RM)" })).toHaveValue("41.00");
  await expect(form.getByText("RM 47.81")).toBeVisible();
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
  await expect(form.getByRole("alert")).toHaveText("Scanning is busy right now. Try again later, or type it in.");
  await expect(form.getByRole("textbox", { name: "What for" })).toHaveValue("");
  await expect(form.getByText("Scan a receipt")).toBeVisible();
});

test("without a Gemini key, scanning says it isn't available", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await scanReceipt(page);
  await expect(form.getByRole("alert")).toHaveText("Scanning isn't available right now. Type it in instead.");
});
