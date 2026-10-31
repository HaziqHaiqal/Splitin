import { expect, test } from "@playwright/test";
import { button, openAs, openBill, panel, payLine, pickMe, seed, sheet } from "./helpers";

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
  await expect(sheet(page).getByRole("button", { name: "Mark paid" })).toBeVisible();
});
