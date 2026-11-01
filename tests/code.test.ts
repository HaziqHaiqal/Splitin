import { expect, test, type Page } from "@playwright/test";
import {
  BILL,
  button,
  CODE,
  getDb,
  newPhone,
  ownerStorage,
  panel,
  pickMe,
  saveDb,
  seed,
  seedWithCode,
  sheet,
  text,
  trip,
} from "./helpers";

const NOT_FOUND = "No receipt with that code";
const draft = { "splitin:draft:v2": { doc: trip, billId: null, seenAt: "" } };
const codeBox = (page: Page) => page.getByLabel("Enter your code");
const codeRow = (page: Page) => sheet(page).getByRole("button", { name: /^Code / });

async function enter(page: Page, code: string) {
  await button(page, "Have a code?").click();
  await expect(codeBox(page)).toBeFocused();
  await codeBox(page).fill(code);
}

async function share(page: Page, label = "Share receipt", ready = "Copy link") {
  await page.goto("/");
  await button(page, label).click();
  await expect(sheet(page).getByText(ready)).toBeVisible();
  const db = await getDb();
  return db.bills.find((b) => b.id !== BILL)?.id as string;
}

async function sentToWhatsApp(page: Page, label = "Send to WhatsApp") {
  await sheet(page).getByRole("button", { name: label }).click();
  const opened = await page.evaluate(() => (window as unknown as { opened: string }).opened);
  return decodeURIComponent(opened);
}

const linkTo = (page: Page, id: string) => `${new URL(page.url()).origin}/bill/${id}`;

const catchWhatsApp = (page: Page) =>
  page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { value: undefined });
    window.open = ((url: string) => {
      (window as unknown as { opened: string }).opened = url;
      return null;
    }) as typeof window.open;
  });

test.describe("sharing a code", () => {
  test.beforeEach(() => seed());

  test("a new bill gets a short code, shown in the pop-up and on the receipt", async ({ browser }) => {
    const owner = await newPhone(browser, draft);
    const code = await share(owner);
    expect(code).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    await expect(codeRow(owner)).toHaveText(`Code${code}Copy`);
    await expect(text(owner, `CODE ${code}`)).toBeAttached();
  });

  test("tapping the code copies it", async ({ browser }) => {
    const owner = await newPhone(browser, draft);
    await owner.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const code = await share(owner);
    await codeRow(owner).click();
    await expect(text(owner, "Code copied")).toBeVisible();
    expect(await owner.evaluate(() => navigator.clipboard.readText())).toBe(code);
  });

  test("the WhatsApp message is set out in lines, with the code and the link", async ({ browser }) => {
    const owner = await newPhone(browser, draft);
    await catchWhatsApp(owner);
    const code = await share(owner);
    const message = await sentToWhatsApp(owner);
    expect(message).toContain(
      `*Trip*\nRM 300.00 · 3 people\nCode: ${code}\n\nTap to see what you owe and mark paid:\n${linkTo(owner, code)}`,
    );
  });

  test("the message is in BM too", async ({ browser }) => {
    const owner = await newPhone(browser, draft);
    await owner.context().addCookies([{ name: "splitin-locale", value: "ms", url: "http://localhost:3457" }]);
    await catchWhatsApp(owner);
    const code = await share(owner, "Kongsi resit", "Salin pautan");
    const message = await sentToWhatsApp(owner, "Hantar ke group WhatsApp");
    expect(message).toContain(
      `*Trip*\nRM 300.00 · 3 orang\nKod: ${code}\n\nTekan untuk lihat berapa anda berhutang dan tanda dah bayar:\n${linkTo(owner, code)}`,
    );
  });

  test("More apps sends the same lines, without WhatsApp's bold stars", async ({ browser }) => {
    const owner = await newPhone(browser, draft);
    await owner.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        value: async (data: ShareData) => {
          (window as unknown as { shared: ShareData }).shared = data;
        },
      });
    });
    const code = await share(owner);
    await sheet(owner).getByRole("button", { name: "More apps" }).click();
    const shared = await owner.evaluate(() => (window as unknown as { shared: ShareData }).shared);
    expect(shared.text).toBe(`Trip\nRM 300.00 · 3 people\nCode: ${code}\n\nTap to see what you owe and mark paid:`);
    expect(shared.url).toBe(linkTo(owner, code));
  });

  test("the link preview spells out the numbers", async ({ page }) => {
    await page.goto(`/bill/${BILL}`);
    await expect(page.locator('meta[property="og:description"]').first()).toHaveAttribute(
      "content",
      "RM 300.00 · 3 people · 2 to settle",
    );
    expect((await page.request.get(`/bill/${BILL}/opengraph-image`)).status()).toBe(200);
  });

  test("the saved picture's file name has the code", async ({ browser }) => {
    const owner = await newPhone(browser, draft);
    const code = await share(owner);
    await expect(sheet(owner).getByRole("button", { name: "Save image" })).toBeEnabled();
    const [download] = await Promise.all([
      owner.waitForEvent("download"),
      sheet(owner).getByRole("button", { name: "Save image" }).click(),
    ]);
    expect(download.suggestedFilename()).toContain(code);
  });

  test("older bills keep their link and show no code", async ({ browser }) => {
    const owner = await newPhone(browser, ownerStorage());
    await catchWhatsApp(owner);
    await owner.goto("/");
    await button(owner, "Share receipt").click();
    await expect(sheet(owner).getByText("Copy link")).toBeVisible();
    await expect(codeRow(owner)).toHaveCount(0);
    await expect(owner.getByText(`CODE ${BILL}`)).toHaveCount(0);
    const message = await sentToWhatsApp(owner);
    expect(message).toContain(
      `*Trip*\nRM 300.00 · 3 people\n\nTap to see what you owe and mark paid:\n${linkTo(owner, BILL)}`,
    );
  });
});

test.describe("entering a code", () => {
  test.beforeEach(() => seedWithCode());

  test("the 8th character opens the bill, even in small letters, and then asks who you are", async ({ page }) => {
    await page.goto("/");
    await enter(page, ` ${CODE.toLowerCase().slice(0, 4)}-${CODE.toLowerCase().slice(4)} `);
    await expect(page).toHaveURL(new RegExp(`/bill/${CODE}$`));
    await pickMe(page, "Najmi");
    await expect(button(page, "Hi Najmi")).toBeVisible();
  });

  test("a wrong code stays and says so, then fixing the last letter opens it", async ({ page }) => {
    await page.goto("/");
    await enter(page, `${CODE.slice(0, 7)}2`);
    await expect(text(page, NOT_FOUND)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await codeBox(page).press("Z");
    await expect(text(page, NOT_FOUND)).toBeVisible();

    await codeBox(page).press("Backspace");
    await expect(page.getByText(NOT_FOUND)).toHaveCount(0);
    await codeBox(page).press(CODE[7]);
    await expect(page).toHaveURL(new RegExp(`/bill/${CODE}$`));
  });

  test("a code that has gone says it expired", async ({ page }) => {
    await saveDb({ expired_bills: [{ id: CODE }] });
    await page.goto("/");
    await enter(page, CODE);
    await expect(text(page, "This receipt has expired")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("a pasted link opens too", async ({ page }) => {
    await page.goto("/");
    await enter(page, `https://www.splitin.me/bill/${CODE}`);
    await expect(page).toHaveURL(new RegExp(`/bill/${CODE}$`));
  });

  test("shows one box per letter, typed or pasted, with nothing to press", async ({ page }) => {
    await page.goto("/");
    await button(page, "Have a code?").click();
    const boxes = codeBox(page).locator("xpath=..").locator("span");
    await expect(boxes).toHaveText(["", "", "", "", "", "", "", ""]);
    await expect(button(page, "Open receipt")).toHaveCount(0);

    await codeBox(page).pressSequentially("K7Q");
    await expect(boxes).toHaveText(["K", "7", "Q", "", "", "", "", ""]);
    await page.keyboard.press("Backspace");
    await expect(boxes).toHaveText(["K", "7", "", "", "", "", "", ""]);
    await expect(page).toHaveURL(/\/$/);

    await codeBox(page).blur();
    await codeBox(page).focus();
    await page.keyboard.type("Q");
    await expect(boxes).toHaveText(["K", "7", "Q", "", "", "", "", ""]);

    await codeBox(page).fill("https://www.splitin.me/bill/H3XPMQ7K");
    await expect(boxes).toHaveText(["H", "3", "X", "P", "M", "Q", "7", "K"]);
    await expect(text(page, NOT_FOUND)).toBeVisible();
  });

  test("works with a bill already on the phone, and going back keeps that bill", async ({ browser }) => {
    const phone = await newPhone(browser, ownerStorage());
    await phone.goto("/");
    await button(phone, "Have a code?").click();
    await expect(panel(phone).getByText("Enter your code")).toBeVisible();
    await expect(button(phone, "Have a code?")).toHaveCount(0);
    await expect(button(phone, "Share receipt")).toHaveCount(0);

    await button(phone, "Back to my bill").click();
    await expect(button(phone, "Share receipt")).toBeVisible();
    await expect(button(phone, "Have a code?")).toBeVisible();
    await expect(text(phone, "HOTEL")).toBeVisible();
  });

  test("the code replaces the first screen, and going back keeps what was typed", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Bill name").fill("Trip");
    await button(page, "Have a code?").click();
    await expect(page.getByLabel("Bill name")).toBeHidden();
    await button(page, "Start a new bill instead").click();
    await expect(page.getByLabel("Bill name")).toHaveValue("Trip");
    await expect(codeBox(page)).toHaveCount(0);
  });
});

test("nothing on the first screen is highlighted until you tap it", async ({ page }) => {
  await page.goto("/");
  const name = page.getByLabel("Bill name");
  await expect(name).not.toBeFocused();
  await expect(name).toHaveCSS("box-shadow", "none");
  await name.click();
  await expect(name).not.toHaveCSS("box-shadow", "none");
});
