import { expect, test, type Page } from "@playwright/test";
import {
  BILL,
  button,
  CODE,
  dinner,
  getDb,
  hotel,
  markExpired,
  newPhone,
  openMenu,
  ownerStorage,
  panel,
  patchDoc,
  paymentRow,
  pickMe,
  seed,
  seedWithCode,
  sheet,
  text,
  TOKEN,
  trip,
  shareFromHome,
} from "./helpers";

const NOT_FOUND = "No receipt with that code";
const draft = { "splitin:draft:v2": { doc: trip, billId: null } };
const codeBox = (page: Page) => page.getByLabel("Enter your code");
const codeRow = (page: Page) => sheet(page).getByRole("button", { name: /^Code / });

async function enter(page: Page, code: string) {
  await button(page, "Have a code?").click();
  await expect(codeBox(page)).toBeFocused();
  await codeBox(page).fill(code);
}

async function share(page: Page, label = "Share receipt", ready = "Copy link") {
  await page.goto("/");
  await shareFromHome(page, label);
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

async function red(page: Page, png: Buffer, x: number, y: number) {
  return page.evaluate(
    async ({ src, x, y }) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      return context.getImageData(x, y, 1, 1).data[0];
    },
    { src: `data:image/png;base64,${png.toString("base64")}`, x, y },
  );
}

test.describe("sharing from a bill page", () => {
  const icon = (page: Page) => button(page, "Share receipt");
  const pictureReady = (page: Page) => expect(sheet(page).locator("img")).toBeVisible();
  const openShare = async (page: Page) => {
    await openMenu(page);
    await button(page, /^Share receipt/).click();
  };

  test("a member can share, with numbers changed after the page opened", async ({ page }) => {
    await seed();
    await catchWhatsApp(page);
    await page.goto(`/bill/${BILL}`);
    await sheet(page).getByRole("button", { name: "Just looking" }).click();
    await patchDoc((doc) => ({ ...doc, items: [hotel, dinner] }));

    await openShare(page);
    await pictureReady(page);
    await expect(page.locator("[inert]").getByText("DINNER")).toBeAttached();
    const message = await sentToWhatsApp(page);
    expect(message).toContain("RM 390.00");
    expect(message.endsWith(`/bill/${BILL}`)).toBe(true);
    expect(message).not.toContain("#owner");
  });

  test("the picture leaves out the page's tap hints", async ({ page }) => {
    await seed();
    await page.goto(`/bill/${BILL}`);
    await sheet(page).getByRole("button", { name: "Just looking" }).click();
    await expect(button(page, "Paid? Tap to pick your name")).toBeVisible();
    await openShare(page);
    await pictureReady(page);
    await expect(page.locator("[inert]").getByText("HOTEL")).toBeAttached();
    await expect(page.locator("[inert]").getByText("Paid? Tap to pick your name")).toHaveCount(0);
  });

  test("the owner shares from the menu, and the pop-up shows the code", async ({ browser }) => {
    await seed();
    const owner = await newPhone(browser, ownerStorage());
    await owner.goto(`/bill/${BILL}`);
    await openShare(owner);
    await pictureReady(owner);
    await expect(codeRow(owner)).toHaveText(`Code${BILL}Copy`);
    await owner.keyboard.press("Escape");
    await expect(sheet(owner)).toHaveCount(0);
  });

  test("a phone that darkens websites keeps the page light and the picture white", async ({ playwright }) => {
    await seed();
    const dark = await playwright.chromium.launch({
      channel: "chrome",
      args: ["--enable-features=WebContentsForceDark"],
    });
    try {
      const page = await dark.newPage({
        baseURL: "http://localhost:3457",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        colorScheme: "dark",
      });
      await page.goto(`/bill/${BILL}`);
      await sheet(page).getByRole("button", { name: "Just looking" }).click();
      await page.waitForTimeout(300);
      expect(await red(page, await page.screenshot(), 10, 10)).toBeGreaterThan(200);

      await openShare(page);
      const picture = sheet(page).locator("img");
      await expect(picture).toBeVisible();
      const src = await picture.evaluate(async (img: HTMLImageElement) => {
        const bytes = new Uint8Array(await (await fetch(img.src)).arrayBuffer());
        return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
      });
      expect(await red(page, Buffer.from(src, "base64"), 70, 200)).toBeGreaterThan(240);
    } finally {
      await dark.close();
    }
  });

  test("the owner can share once everyone has paid", async ({ browser }) => {
    await seed(trip, { payments: [paymentRow("n", "h", 10000), paymentRow("a", "h", 10000)] });
    const owner = await newPhone(browser, ownerStorage());
    await owner.goto(`/bill/${BILL}`);
    await expect(text(owner, "Everyone's paid.")).toBeVisible();
    await icon(owner).click();
    await pictureReady(owner);
    await expect(owner.locator("[inert]").getByText("SETTLED")).toBeAttached();
  });
});

test.describe("sharing a code", () => {
  test.beforeEach(() => seed());

  test("a new bill gets a short code, shown in the pop-up and on the receipt", async ({ browser }) => {
    const owner = await newPhone(browser, draft);
    const code = await share(owner);
    expect(code).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    await expect(owner).toHaveURL(new RegExp(`/bill/${code}$`));
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

  test("the link preview has the bill name and no amounts", async ({ page }) => {
    await page.goto(`/bill/${BILL}`);
    await expect(page.locator('meta[property="og:title"]').first()).toHaveAttribute("content", "Trip");
    await expect(page.locator('meta[property="og:description"]').first()).toHaveAttribute(
      "content",
      "Tap to see the latest amounts and who pays who.",
    );
  });

  test("the link preview stays the same when the amounts change", async ({ page }) => {
    const pictureOf = async () => {
      await page.goto(`/bill/${BILL}`);
      const picture = await page.locator('meta[property="og:image"]').first().getAttribute("content");
      const { pathname, search } = new URL(picture!);
      const response = await page.request.get(pathname + search);
      expect(response.status()).toBe(200);
      return { pathname, body: await response.body() };
    };
    const before = await pictureOf();
    expect(before.pathname).toBe(`/bill/${BILL}/opengraph-image`);
    await patchDoc((doc) => ({ ...doc, items: [hotel, dinner] }));
    const after = await pictureOf();
    expect(after.pathname).toBe(before.pathname);
    expect(after.body.equals(before.body)).toBe(true);
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

  test("older bills keep their link and show no code", async ({ browser }) => {
    const oldLink = "TestBill01";
    await seed(trip, {}, oldLink);
    const owner = await newPhone(browser, { [`splitin:owner:${oldLink}`]: TOKEN });
    await catchWhatsApp(owner);
    await owner.goto(`/bill/${oldLink}`);
    await openMenu(owner);
    await button(owner, /^Share receipt/).click();
    await expect(sheet(owner).getByText("Copy link")).toBeVisible();
    await expect(codeRow(owner)).toHaveCount(0);
    await expect(owner.getByText(`CODE ${oldLink}`)).toHaveCount(0);
    const message = await sentToWhatsApp(owner);
    expect(message).toContain(
      `*Trip*\nRM 300.00 · 3 people\n\nTap to see what you owe and mark paid:\n${linkTo(owner, oldLink)}`,
    );
    await owner.goto(`/bill/${oldLink}`);
    await expect(text(owner, "Hi Haziq")).toBeVisible();
  });

  test("a code that has gone says it expired", async ({ page }) => {
    await markExpired(CODE);
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
    const phone = await newPhone(browser, draft);
    await phone.goto("/");
    await button(phone, "Have a code?").click();
    await expect(panel(phone).getByText("Enter your code")).toBeVisible();
    await expect(button(phone, "Have a code?")).toHaveCount(0);
    await expect(button(phone, "Menu")).toHaveCount(0);

    await button(phone, "Back to my bill").click();
    await expect(button(phone, "Menu")).toBeVisible();
    await expect(button(phone, "Have a code?")).toBeVisible();
    await expect(text(phone, "HOTEL")).toBeVisible();
  });

  test("the code replaces the first screen, and going back keeps what was typed", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("What are you splitting?").fill("Trip");
    await button(page, "Have a code?").click();
    await expect(page.getByLabel("What are you splitting?")).toBeHidden();
    await button(page, "Start a new bill instead").click();
    await expect(page.getByLabel("What are you splitting?")).toHaveValue("Trip");
    await expect(codeBox(page)).toHaveCount(0);
  });
});

test("nothing on the first screen is highlighted until you tap it", async ({ page }) => {
  await page.goto("/");
  const name = page.getByLabel("What are you splitting?");
  const field = name.locator("xpath=../..");
  await expect(name).not.toBeFocused();
  await expect(field).toHaveCSS("box-shadow", "none");
  await name.click();
  await expect(field).not.toHaveCSS("box-shadow", "none");
});
