import { expect, test, type Locator } from "@playwright/test";
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
  text,
  tick,
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

test("the cursor starts in the bill name, and the code replaces the form", async ({ page }) => {
  await seedWithCode();
  await page.goto("/");
  await expect(page.getByLabel("What are you splitting?")).toBeFocused();
  await button(page, "Have a code?").click();
  await expect(page.getByLabel("Enter your code")).toBeFocused();
  await expect(page.getByLabel("What are you splitting?")).toBeHidden();
  await page.getByLabel("Enter your code").fill(CODE);
  await expect(page).toHaveURL(new RegExp(`/bill/${CODE}$`));
});

test("the side holds the name, Share, the buttons and your bills, with the receipt beside it", async ({ page }) => {
  await openAs(page, "Najmi");
  const box = async (locator: Locator) => (await locator.boundingBox())!;
  const hi = await box(button(page, "Hi Najmi"));
  const share = await box(button(page, /^Share receipt/));
  const add = await box(button(page, "Add bill"));
  const history = await box(page.getByRole("button", { name: "History", exact: true }));
  const bills = await box(tick(page, "Hotel"));
  const paper = await box(page.getByText("HOTEL").first());
  const side = await box(page.locator("main"));
  expect(share.y).toBeGreaterThan(hi.y);
  expect(add.y).toBeGreaterThan(share.y + share.height);
  expect(Math.abs(history.y - add.y)).toBeLessThan(2);
  expect(history.x).toBeGreaterThan(add.x);
  expect(bills.y).toBeGreaterThan(add.y + add.height);
  expect(side.width).toBe(640);
  expect(paper.x).toBeGreaterThan(side.width);
  await expect(page.getByRole("button", { name: "Menu", exact: true })).toHaveCount(0);

  await button(page, "Add bill").click();
  await expect(page.getByText("Add what you paid")).toBeVisible();
  await expect(page.getByText("HOTEL").first()).toBeVisible();
});

test("a tick joins at once, and a bill opens beside its row with your part", async ({ page }) => {
  await seed({ ...trip, items: [hotel, { ...dinner, participants: ["h", "a"] }] });
  await openAs(page, "Najmi");
  await tick(page, "Dinner").click();
  await expect(text(page, "Joined Dinner. You pay RM 30.00.")).toBeVisible();
  await expect(page.getByText("30.00 EACH").first()).toBeVisible();

  await page.getByRole("button", { name: /^Dinner/ }).click();
  const part = page.getByRole("textbox", { name: "Your amount for Dinner" });
  await expect(part).toBeVisible();
  await expect(page.getByText("Haziq paid RM 90.00, split between Haziq, Afiq and you.")).toBeVisible();
  await expect(sheet(page)).toHaveCount(0);
  await expect(panel(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(part).toHaveCount(0);
});

test("bank details open in the panel", async ({ page }) => {
  await seed({ ...trip, people: [{ ...trip.people[0], bank: "Maybank", accountNo: "7012" }, ...trip.people.slice(1)] });
  await openAs(page, "Najmi");
  await button(page, "Bank details Haziq").click();
  await expect(page.getByText("Haziq's bank details")).toBeVisible();
  await expect(page.getByText("7012")).toBeVisible();
  await expect(sheet(page)).toHaveCount(0);
});
