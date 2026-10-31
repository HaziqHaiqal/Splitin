import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { choose, openBill, panel, pickMe, seed, trip } from "./helpers";

const people = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, name: `Person number ${i}`, color: i }));

async function drag(cdp: CDPSession, page: Page, from: [number, number], to: [number, number]) {
  const point = (i: number) => ({
    x: from[0] + ((to[0] - from[0]) * i) / 12,
    y: from[1] + ((to[1] - from[1]) * i) / 12,
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(0)] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(i)] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(500);
}

test("the page stays still behind the form while typing", async ({ page }) => {
  await seed({
    ...trip,
    people,
    ownerId: "p0",
    items: [{ ...trip.items[0], paidBy: "p0", participants: ["p0", "p1"] }],
  });
  const cdp = await page.context().newCDPSession(page);
  await openBill(page);
  await choose(page, "Add what I paid");
  await pickMe(page, "Person number 1");
  const form = panel(page);
  await expect(form.getByText("Add what you paid")).toBeVisible();
  await page.waitForTimeout(1200);

  const scrollY = () => page.evaluate(() => Math.round(window.scrollY));
  const top = async () => Math.round((await form.boundingBox())!.y);
  const toTop = async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
  };
  const dragBehind = async () => drag(cdp, page, [195, (await top()) - 30], [195, 80]);

  await toTop();
  await dragBehind();
  expect(await scrollY(), "not typing: dragging the page still scrolls it").toBeGreaterThan(50);
  await toTop();

  const name = form.locator("input[maxlength='60']");
  await name.focus();
  await expect.poll(() => form.evaluate((el) => (el as HTMLElement).style.bottom)).toBe("auto");
  const pinned = await top();

  await dragBehind();
  expect(await scrollY(), "typing: dragging behind the form does nothing").toBe(0);

  await drag(cdp, page, [195, pinned + 40], [195, pinned + 240]);
  await drag(cdp, page, [195, pinned + 240], [195, pinned + 40]);
  expect(await scrollY(), "typing: dragging the form does not move the page").toBe(0);
  expect(await top(), "typing: the form stays put").toBe(pinned);

  const row = form.locator(".overflow-x-auto").first();
  const box = (await row.boundingBox())!;
  await drag(cdp, page, [330, box.y + box.height / 2], [60, box.y + box.height / 2]);
  expect(await row.evaluate((el) => el.scrollLeft), "typing: Who paid can be swiped sideways").toBeGreaterThan(50);

  await page.keyboard.insertText("Petrol");
  await expect(name).toHaveValue("Petrol");

  const shrink = (height: number) =>
    cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height, deviceScaleFactor: 2, mobile: true });
  await shrink(200);
  await page.waitForTimeout(500);
  expect(await form.evaluate((el) => el.scrollHeight > el.clientHeight), "short screen: form is taller").toBe(true);
  await drag(cdp, page, [195, 170], [195, 30]);
  expect(await form.evaluate((el) => el.scrollTop), "short screen: scrolls inside the form").toBeGreaterThan(20);
  expect(await scrollY(), "short screen: page stays still").toBe(0);
  await shrink(844);
  await page.waitForTimeout(500);

  await name.blur();
  await expect.poll(() => form.evaluate((el) => (el as HTMLElement).style.bottom)).not.toBe("auto");
  await toTop();
  await dragBehind();
  expect(await scrollY(), "after typing: the page scrolls again").toBeGreaterThan(50);
});

test("every form input is at least 16px, so iPhone does not zoom", async ({ page }) => {
  await seed();
  await openBill(page);
  await choose(page, "Add what I paid");
  await pickMe(page, "Najmi");
  const form = panel(page);
  await expect(form.getByText("Add what you paid")).toBeVisible();
  await form.getByRole("button", { name: "+ Add" }).click();
  await form.getByPlaceholder("Name").focus();
  const sizes = await form
    .locator("input")
    .evaluateAll((inputs) => inputs.map((i) => parseFloat(getComputedStyle(i).fontSize)));
  expect(sizes.length).toBeGreaterThan(1);
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16);
});
