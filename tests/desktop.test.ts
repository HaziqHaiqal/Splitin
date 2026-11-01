import { expect, test } from "@playwright/test";
import {
  button,
  CODE,
  dinner,
  hotel,
  openAs,
  openBill,
  panel,
  payLine,
  pickMe,
  seed,
  seedWithCode,
  sheet,
  trip,
} from "./helpers";

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
test.beforeEach(() => seed());

test("the question closes and the form opens with the cursor in it", async ({ page }) => {
  await openBill(page);
  await button(page, "Add bill").click();
  await pickMe(page, "Najmi");
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByText("Add what you paid")).toBeVisible();
  await expect(page.locator("input[maxlength='60']")).toBeFocused();
  await expect(panel(page)).toHaveCount(0);
});

test("the question on opening greets you, then your payment can be marked", async ({ page }) => {
  await openAs(page, "Najmi");
  await expect(button(page, "Hi Najmi")).toBeVisible();
  await payLine(page, "NAJMI", "HAZIQ").click();
  await expect(page.getByRole("button", { name: "Mark paid" })).toBeVisible();
  await expect(sheet(page)).toHaveCount(0);
  await expect(button(page, /NAJMI PAYS HAZIQ/)).toBeVisible();
});

test("the cursor starts in Bill name, and the code replaces the form", async ({ page }) => {
  await seedWithCode();
  await page.goto("/");
  await expect(page.getByLabel("Bill name")).toBeFocused();
  await button(page, "Have a code?").click();
  await expect(page.getByLabel("Enter your code")).toBeFocused();
  await expect(page.getByLabel("Bill name")).toBeHidden();
  await page.getByLabel("Enter your code").fill(CODE);
  await expect(page).toHaveURL(new RegExp(`/bill/${CODE}$`));
});

test("the panel holds the name, History and the buttons, with the receipt beside it", async ({ page }) => {
  await openAs(page, "Najmi");
  const hi = (await button(page, "Hi Najmi").boundingBox())!;
  const history = (await button(page, /^History/).boundingBox())!;
  const add = (await button(page, "Add bill").boundingBox())!;
  const share = (await button(page, "Share receipt").boundingBox())!;
  const paper = (await page.getByText("HOTEL").first().boundingBox())!;
  expect(history.x).toBeGreaterThan(hi.x + hi.width);
  expect(Math.abs(history.y + history.height / 2 - (hi.y + hi.height / 2))).toBeLessThan(2);
  expect(add.y).toBeGreaterThan(hi.y);
  expect(share.x).toBeGreaterThan(add.x + add.width);
  expect(share.x + share.width).toBeLessThanOrEqual(420);
  expect(paper.x).toBeGreaterThan(420);

  await button(page, "Add bill").click();
  await expect(page.getByText("Add what you paid")).toBeVisible();
  await expect(page.getByText("HOTEL").first()).toBeVisible();
});

test("Join opens in the panel and the receipt beside it changes at once", async ({ page }) => {
  await seed({ ...trip, items: [hotel, { ...dinner, participants: ["h", "a"] }] });
  await openAs(page, "Najmi");
  await button(page, "Join Dinner").click();
  await expect(page.getByText("Which bills are you in?")).toBeVisible();
  await expect(sheet(page)).toHaveCount(0);
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByText("30.00 EACH").first()).toBeVisible();
});

test("bank details open in the panel", async ({ page }) => {
  await seed({ ...trip, people: [{ ...trip.people[0], bank: "Maybank", accountNo: "7012" }, ...trip.people.slice(1)] });
  await openAs(page, "Najmi");
  await button(page, "Bank details Haziq").click();
  await expect(page.getByText("Haziq's bank details")).toBeVisible();
  await expect(page.getByText("7012")).toBeVisible();
  await expect(sheet(page)).toHaveCount(0);
});
