import { expect, test } from "@playwright/test";
import { BILL, getDb, saveDb, seed, text } from "./helpers";

const DAY = 86_400_000;
const EXPIRED = "This receipt has expired";
const NOT_FOUND = "We can't find this receipt";

async function seedAged(days: number) {
  await seed();
  const db = await getDb();
  db.bills[0].created_at = new Date(Date.now() - days * DAY).toISOString();
  await saveDb(db);
}

test.describe("old links", () => {
  test("a link the cleanup job deleted says it expired", async ({ page }) => {
    await saveDb({ expired_bills: [{ id: BILL }] });
    await page.goto(`/bill/${BILL}`);
    await expect(text(page, EXPIRED)).toBeVisible();
    await expect(page.getByText(NOT_FOUND)).toHaveCount(0);
    await expect(page).toHaveTitle(new RegExp(EXPIRED));
  });

  test("a link past 30 days that isn't deleted yet says it expired", async ({ page }) => {
    await seedAged(31);
    await page.goto(`/bill/${BILL}`);
    await expect(text(page, EXPIRED)).toBeVisible();
    await expect(page.getByText("HOTEL")).toHaveCount(0);
  });

  test("a link still inside 30 days opens", async ({ page }) => {
    await seedAged(29);
    await page.goto(`/bill/${BILL}`);
    await expect(text(page, "HOTEL")).toBeVisible();
    await expect(page.getByText(EXPIRED)).toHaveCount(0);
  });

  test("a link that never existed says it can't be found", async ({ page }) => {
    await saveDb({ expired_bills: [{ id: BILL }] });
    await page.goto("/bill/NoSuchLink1");
    await expect(text(page, NOT_FOUND)).toBeVisible();
    await expect(page.getByText(EXPIRED)).toHaveCount(0);
  });
});
