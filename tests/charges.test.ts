import { expect, test } from "@playwright/test";
import {
  closePhones,
  hotel,
  joinButton,
  newPhone,
  openAs,
  openBill,
  openBillDetail,
  openBills,
  ownerStorage,
  seed,
  serverDoc,
  serverItem,
  settled,
  startAdding,
  submit,
  text,
  trip,
} from "./helpers";
import type { Item } from "../src/lib/bill";

const dinner: Item = {
  id: "dinner",
  name: "Dinner",
  amountMinor: 11660,
  paidBy: "h",
  participants: ["h", "n", "a"],
  overrides: { h: 4000 },
  charges: { subtotalMinor: 10000, serviceBp: 1000, taxBp: 600 },
};

test.afterEach(() => closePhones());

test("adds a bill with service charge and SST, typed as the price before them", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await startAdding(page, "Dinner", "10000", "Najmi");
  await form.getByRole("button", { name: "+ Service charge / SST" }).click();
  await form.getByRole("checkbox", { name: "Service charge" }).click();
  await form.getByRole("checkbox", { name: "SST" }).click();
  await expect(form.getByText("+10.00")).toBeVisible();
  await expect(form.getByText("+6.60")).toBeVisible();
  await expect(form.getByText("RM 116.60")).toBeVisible();
  await submit(form);

  const added = async () => {
    const item = (await serverDoc()).items.find((i) => i.name === "Dinner");
    return item && { amountMinor: item.amountMinor, charges: item.charges };
  };
  await settled(added, { amountMinor: 11660, charges: { subtotalMinor: 10000, serviceBp: 1000, taxBp: 600 } });
  await expect(text(page, "INCL. SERVICE 10% · SST 6%")).toBeVisible();
});

test("a different SST rate can be typed", async ({ page }) => {
  await seed();
  await openBill(page);
  const form = await startAdding(page, "Phone bill", "5000", "Najmi");
  await form.getByRole("button", { name: "+ Service charge / SST" }).click();
  await form.getByRole("textbox", { name: "SST (%)" }).fill("8");
  await expect(form.getByText("RM 54.00")).toBeVisible();
  await submit(form);
  await expect(text(page, "INCL. SST 8%")).toBeVisible();
});

test("each person pays what they had plus their part of the charges", async ({ page }) => {
  await seed({ ...trip, items: [dinner] });
  await openAs(page, "Najmi");
  await expect(text(page, "INCL. SERVICE 10% · SST 6%")).toBeVisible();
  await expect(text(page, "HAZIQ 46.64 · OTHERS 34.98 EACH")).toBeVisible();
  await expect(text(page, "116.60")).toBeVisible();
});

test("your part is typed before charges and shown with them", async ({ page }) => {
  await seed({ ...trip, items: [hotel, { ...dinner, participants: ["h", "a"], overrides: {} }] });
  await openAs(page, "Najmi");
  await openBills(page);
  await joinButton(page, "Dinner").click();
  await settled(async () => (await serverItem("dinner"))?.participants, ["h", "a", "n"]);
  await page.getByRole("button", { name: /^Dinner/ }).click();
  const box = page.getByRole("textbox", { name: /Dinner/ });
  await expect(box).toHaveValue("33.33");
  await box.fill("");
  await box.pressSequentially("2000");
  await expect(text(page, "Before service charge and SST. With them: RM 23.32.")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await settled(async () => (await serverItem("dinner"))?.overrides, { n: 2000 });
});

test("editing keeps the exact total from the receipt", async ({ browser }) => {
  await seed({ ...trip, items: [{ ...dinner, amountMinor: 11665 }] });
  const owner = await newPhone(browser, ownerStorage());
  await openBill(owner);
  await openBillDetail(owner, "Dinner");
  await expect(owner.getByRole("checkbox", { name: "SST" })).toBeChecked();
  await expect(owner.getByText("RM 116.65")).toBeVisible();
  await owner.getByRole("textbox", { name: "What for" }).fill("Dinner out");
  await owner.getByRole("button", { name: "Save", exact: true }).click();
  await settled(async () => {
    const item = await serverItem("dinner");
    return item && [item.name, item.amountMinor];
  }, ["Dinner out", 11665]);
});
