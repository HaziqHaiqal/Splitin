import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import QRCode from "qrcode";
import {
  addMe,
  addName,
  BILL,
  button,
  changePayments,
  choose,
  clearPayments,
  closePhones,
  dinner,
  eventKinds,
  getDb,
  hotel,
  joinAs,
  menuCard,
  newPhone,
  OLD,
  openAs,
  openBill,
  openBillDetail,
  openBills,
  openFresh,
  openHistory,
  openMenu,
  ownerStorage,
  panel,
  patchDoc,
  paymentRow,
  paymentsOf,
  payLine,
  pickMe,
  seed,
  serverDoc,
  serverItem,
  settled,
  sheet,
  startAdding,
  submit,
  text,
  joinButton,
  trip,
} from "./helpers";

test.beforeEach(() => seed());
test.afterEach(() => closePhones());

const names = async () => (await serverDoc()).people.map((p) => p.name);
const itemNames = async () => (await serverDoc()).items.map((i) => i.name);

test.describe("who are you", () => {
  test("asks on opening, without the owner, and greets you", async ({ page }) => {
    await openFresh(page);
    const list = sheet(page);
    await expect(list.getByRole("heading", { name: "Who are you?" })).toBeVisible();
    await expect(list.getByRole("button", { name: "Najmi" })).toBeVisible();
    await expect(list.getByRole("button", { name: "Afiq" })).toBeVisible();
    await expect(list.getByRole("button", { name: "Not on the list" })).toBeVisible();
    await expect(list.getByRole("button", { name: "Just looking" })).toBeVisible();
    await expect(list.getByRole("button", { name: "Haziq" })).toHaveCount(0);
    await expect(text(page, "HOTEL")).toBeAttached();

    await list.getByRole("button", { name: "Najmi" }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(button(page, "Hi Najmi")).toBeVisible();
    await expect(page.getByText("Not Najmi?")).toHaveCount(0);

    await page.reload();
    await expect(button(page, "Hi Najmi")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who are you?" })).toHaveCount(0);
  });

  test("Just looking is asked once and leaves a way to choose later", async ({ page }) => {
    await openFresh(page);
    await sheet(page).getByRole("button", { name: "Just looking" }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.getByText(/^Hi /)).toHaveCount(0);

    await page.reload();
    await expect(button(page, "Paid? Tap to pick your name")).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.getByRole("heading", { name: "Who are you?" })).toHaveCount(0);

    await button(page, "Paid? Tap to pick your name").click();
    await expect(sheet(page).getByRole("button", { name: "Just looking" })).toHaveCount(0);
    await pickMe(page, "Afiq");
    await expect(button(page, "Hi Afiq")).toBeVisible();
  });

  test("closing the question counts as Just looking", async ({ page }) => {
    await openFresh(page);
    await expect(sheet(page).getByRole("heading", { name: "Who are you?" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);
    await page.reload();
    await expect(button(page, "Paid? Tap to pick your name")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who are you?" })).toHaveCount(0);
  });

  test("a name not on the list can be added from the question", async ({ page }) => {
    await openFresh(page);
    await addName(page, "Aiman");
    await expect(button(page, "Hi Aiman")).toBeVisible();
    await settled(names, ["Haziq", "Najmi", "Afiq", "Aiman"]);
    await expect(page.getByText("Paid? ")).toHaveCount(0);
  });

  test("the question is just the names and one way out", async ({ page }) => {
    await openFresh(page);
    const list = sheet(page);
    await expect(list.getByRole("heading", { name: "Who are you?" })).toBeVisible();
    await expect(list.locator("p:not(.sr-only)")).toHaveCount(0);
    await expect(list.getByRole("button")).toHaveText([/Najmi$/, /Afiq$/, "Not on the list", "Just looking"]);
    for (const row of await list.getByRole("button").all())
      expect(Math.round((await row.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
    const top = (name: string) => list.getByRole("button", { name }).evaluate((el) => (el as HTMLElement).offsetTop);
    expect(await top("Afiq")).toBe(await top("Najmi"));
  });

  test("a phone that already has a name is not asked", async ({ browser }) => {
    const phone = await newPhone(browser, { [`splitin:me:${BILL}`]: "n" });
    await openFresh(phone);
    await expect(button(phone, "Hi Najmi")).toBeVisible();
    await phone.waitForTimeout(500);
    await expect(phone.getByRole("heading", { name: "Who are you?" })).toHaveCount(0);
  });

  test("leaving your name does not bring the question back", async ({ browser }) => {
    const phone = await newPhone(browser, { [`splitin:me:${BILL}`]: "n" });
    await openFresh(phone);
    await button(phone, "Hi Najmi").click();
    await sheet(phone).getByRole("button", { name: "Just looking" }).click();
    await expect(button(phone, "Paid? Tap to pick your name")).toBeVisible();
    await phone.reload();
    await expect(button(phone, "Paid? Tap to pick your name")).toBeVisible();
    await phone.waitForTimeout(500);
    await expect(phone.getByRole("heading", { name: "Who are you?" })).toHaveCount(0);
  });

  test("a locked bill with no names to choose asks nothing", async ({ page }) => {
    await seed({ ...trip, people: [trip.people[0]], items: [], locked: true });
    await openFresh(page);
    await expect(text(page, "Haziq locked this bill")).toBeVisible();
    await page.waitForTimeout(500);
    await expect(sheet(page)).toHaveCount(0);
    await expect(button(page, "Paid? Tap to pick your name")).toHaveCount(0);
  });

  test("after Just looking, the first action asks and then carries on", async ({ page }) => {
    await openBill(page);
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who are you?" })).toHaveCount(0);

    await choose(page, "Add bill");
    const list = sheet(page);
    await expect(list.getByRole("heading", { name: "Who are you?" })).toBeVisible();
    await expect(list.getByRole("button", { name: "Just looking" })).toHaveCount(0);
    await expect(panel(page)).toHaveCount(0);

    await list.getByRole("button", { name: "Najmi" }).click();
    const form = panel(page);
    await expect(form.getByText("Add what you paid")).toBeVisible();
    await expect(form.getByRole("button", { name: "Najmi", pressed: true })).toBeVisible();
  });

  test("the name can be changed afterwards", async ({ page }) => {
    await openAs(page, "Najmi");
    await button(page, "Hi Najmi").click();
    await pickMe(page, "Afiq");
    await expect(button(page, "Hi Afiq")).toBeVisible();
  });

  test("tapping your name hides it from the list and can leave it", async ({ page }) => {
    await openAs(page, "Najmi");
    await button(page, "Hi Najmi").click();
    const list = sheet(page);
    await expect(list.getByRole("button", { name: "Afiq" })).toBeVisible();
    await expect(list.getByRole("button", { name: "Najmi" })).toHaveCount(0);
    await list.getByRole("button", { name: "Just looking" }).click();

    await expect(button(page, "Hi Najmi")).toHaveCount(0);
    await expect(button(page, "Paid? Tap to pick your name")).toBeVisible();
    expect(await page.evaluate((id) => localStorage.getItem(`splitin:me:${id}`), BILL)).toBeNull();
    await openMenu(page);
    await expect(menuCard(page).getByRole("button", { name: "Add bill" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Your bills/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await button(page, "Who are you?").click();
    await expect(sheet(page).getByRole("button", { name: "Najmi" })).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: "Just looking" })).toHaveCount(0);
  });

  test("the name sits above the receipt, and the rest waits in the menu", async ({ page }) => {
    await openAs(page, "Najmi");
    const name = (await button(page, "Hi Najmi").boundingBox())!;
    const paper = (await text(page, "HOTEL").boundingBox())!;
    expect(name.y).toBeLessThan(paper.y);
    await expect(button(page, "Add bill")).toHaveCount(0);
    await expect(button(page, /^Share receipt/)).toHaveCount(0);

    const fab = (await page.getByRole("button", { name: "Menu", exact: true }).boundingBox())!;
    expect([Math.round(fab.x + fab.width), Math.round(fab.y + fab.height)]).toEqual([374, 828]);
    await openMenu(page);
    const card = menuCard(page);
    await expect(card.getByRole("button", { name: /^Share receipt/ })).toBeVisible();
    for (const label of ["Add bill", "History", "Bank", "Edit name"])
      await expect(card.getByRole("button", { name: label, exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: /^Your bills/ })).toContainText("In 1 of 1 · you pay RM 100.00");
    await expect(button(page, "Close menu")).toBeVisible();
  });

  test("the receipt has no Join or Delete words on bills", async ({ page }) => {
    await openAs(page, "Najmi");
    await expect(button(page, "Hi Najmi")).toBeVisible();
    await expect(button(page, /(Join|Change|Delete) Hotel/)).toHaveCount(0);
  });

  test("before a name is chosen, the top asks who you are and the menu has no bills", async ({ page }) => {
    await openBill(page);
    await expect(button(page, "Who are you?")).toBeVisible();
    await expect(button(page, /(Join|Change|Delete) Hotel/)).toHaveCount(0);
    await openMenu(page);
    await expect(menuCard(page).getByRole("button", { name: "Add bill" })).toBeVisible();
    await expect(menuCard(page).getByRole("button", { name: "Bank", exact: true })).toHaveCount(0);
    await expect(menuCard(page).getByRole("button", { name: /bills/ })).toHaveCount(0);
  });

  test("Add bill opens its form inside the menu, and Back returns to the list", async ({ page }) => {
    await openAs(page, "Najmi");
    await choose(page, "Add bill");
    const card = menuCard(page);
    await expect(card.getByText("Add what you paid")).toBeVisible();
    await card.getByRole("button", { name: "Back" }).click();
    await expect(card.getByRole("button", { name: /^Your bills/ })).toBeVisible();
    await expect(card.getByText("Add what you paid")).toHaveCount(0);
  });

  test("Calculation goes bill by bill to the fewest payments", async ({ page }) => {
    await openAs(page, "Najmi");
    await choose(page, "Calculation");
    const card = menuCard(page);
    await expect(card.getByText("Step 1 of 3")).toBeVisible();
    await expect(card.getByText("Haziq paid Hotel · RM 300.00")).toBeVisible();
    await expect(card.getByText("Najmi and Afiq owe Haziq RM 100.00.")).toBeVisible();
    await card.getByRole("button", { name: /^Next/ }).click();
    await expect(card.getByText("Add up each person")).toBeVisible();
    await card.getByRole("button", { name: /^Next/ }).click();
    await expect(card.getByText("Haziq gets RM 200.00: Najmi 100.00 + Afiq 100.00.")).toBeVisible();
    await expect(card.getByText("2 payments in total.")).toBeVisible();
    await card.getByRole("button", { name: "Done" }).click();
    await expect(card.getByRole("button", { name: /^Your bills/ })).toBeVisible();
  });

  test("with no bills yet the menu still adds, after asking the name", async ({ page }) => {
    await seed({ ...trip, items: [] });
    await openBill(page);
    await choose(page, "Add bill");
    await pickMe(page, "Najmi");
    await expect(panel(page).getByText("Add what you paid")).toBeVisible();
  });
});

test.describe("adding your own name", () => {
  test("adds the name, changes no amount, then carries on", async ({ page }) => {
    await openBill(page);
    await choose(page, "Add bill");
    await addName(page, "Aiman");
    await expect(panel(page).getByText("Add what you paid")).toBeVisible();
    await settled(names, ["Haziq", "Najmi", "Afiq", "Aiman"]);
    expect((await serverDoc()).items).toEqual([hotel]);
    await expect(text(page, "100.00 EACH")).toBeVisible();
    await expect(page.getByText(/NOT AIMAN/)).toHaveCount(0);
    await expect(text(page, "3 PEOPLE × EACH")).toBeVisible();
    expect(await eventKinds()).toEqual(["person_joined"]);
  });

  test("refuses a name already on the bill", async ({ page }) => {
    await openBill(page);
    await choose(page, "Add bill");
    await addName(page, "najmi");
    await expect(text(page, "najmi is already in the list")).toBeVisible();
    expect(await names()).toEqual(["Haziq", "Najmi", "Afiq"]);
  });

  test("two people adding the same name at once: only one gets it", async ({ browser }) => {
    const a = await newPhone(browser);
    const b = await newPhone(browser);
    for (const page of [a, b]) {
      await openBill(page);
      await choose(page, "Add bill");
      await pickMe(page, "Not on the list");
      await panel(page).getByPlaceholder("Name").fill("Aiman");
    }
    await Promise.all([a, b].map((page) => panel(page).getByRole("button", { name: "Add", exact: true }).click()));
    await settled(async () => (await names()).filter((n) => n === "Aiman").length, 1);
    const refused = async () =>
      (await a.getByText("Aiman is already in the list").count()) +
      (await b.getByText("Aiman is already in the list").count());
    await expect.poll(refused).toBe(1);
  });

  test("stops at 50 people", async ({ page }) => {
    const people = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, name: `Person ${i}`, color: i }));
    await seed({ ...trip, ownerId: "p0", people, items: [] });
    await openBill(page);
    await choose(page, "Add bill");
    await addName(page, "Aiman");
    await expect(text(page, "Something went wrong")).toBeVisible();
    expect(await names()).toHaveLength(50);
  });

  test("bank details never print on the receipt, and anyone else can only read them", async ({ page, browser }) => {
    await openBill(page);
    await choose(page, "Add bill");
    await addName(page, "Aiman");
    const add = panel(page);
    await expect(add.getByText("Add what you paid")).toBeVisible();
    await add.locator("input[maxlength='60']").fill("Snacks");
    await add.locator("input[inputmode='numeric']").pressSequentially("3000");
    await submit(add);
    await settled(async () => (await serverDoc()).items.length, 2);

    await button(page, "Add bank details Aiman").click();
    const form = panel(page);
    await form.getByRole("button", { name: "Maybank" }).click();
    await form.locator("input[inputmode='numeric']").fill("1234567890");
    await expect(page.getByText(/MAYBANK/)).toHaveCount(0);
    await submit(form);
    await settled(async () => (await serverDoc()).people[3].bank, "Maybank");
    expect((await serverDoc()).people[3].accountNo).toBe("1234567890");
    expect(JSON.stringify((await getDb()).bill_events)).not.toContain("1234567890");

    await expect(text(page, "Your bank details are saved")).toBeVisible();
    await expect(page.getByText("1234567890")).toHaveCount(0);
    await button(page, "Bank details Aiman").click();
    await expect(panel(page).locator("input[inputmode='numeric']")).toHaveValue("1234567890");

    const other = await newPhone(browser);
    await openBill(other);
    await expect(other.getByText("1234567890")).toHaveCount(0);
    await button(other, "Bank details Aiman").click();
    const details = sheet(other);
    await expect(details.getByRole("heading", { name: "Aiman's bank details" })).toBeVisible();
    await expect(details.getByText("Maybank")).toBeVisible();
    await expect(details.getByText("1234567890")).toBeVisible();
    await expect(details.getByRole("button", { name: "Copy" })).toBeVisible();
    await expect(panel(other)).toHaveCount(0);
  });

  const DUITNOW =
    "00020201021126520014A000000615000101065887340220000000000012345678905204000053034585802MY5913AIMAN BIN ALI6002KL63042103";
  const AMIR =
    "00020201021126520014A000000615000101068900530220000000000012345678905204000053034585802MY5917AMIR BIN ZULKIFLI6002KL63046AFF";
  const scansAs = (page: Page, source: string | null) =>
    page.evaluate(async (url) => {
      const canvas = url
        ? document.createElement("canvas")
        : document.querySelector<HTMLCanvasElement>("canvas[role=img]")!;
      if (url) {
        const picture = new Image();
        picture.src = url;
        await picture.decode();
        Object.assign(canvas, { width: picture.width, height: picture.height });
        canvas.getContext("2d")!.drawImage(picture, 0, 0);
      }
      const { data, width, height } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
      return (
        window as unknown as { jsQR: (d: Uint8ClampedArray, w: number, h: number) => { data: string } | null }
      ).jsQR(data, width, height)?.data;
    }, source);
  const loadReader = (page: Page) => page.addScriptTag({ path: "node_modules/jsqr/dist/jsQR.js" });
  const qrPicture = async (code: string, name = "qr.png") => ({
    name,
    mimeType: "image/png",
    buffer: await QRCode.toBuffer(code, { width: 400 }),
  });
  const owedAiman = async (page: Page) => {
    await openBill(page);
    await choose(page, "Add bill");
    await addName(page, "Aiman");
    const add = panel(page);
    await expect(add.getByText("Add what you paid")).toBeVisible();
    await add.locator("input[maxlength='60']").fill("Snacks");
    await add.locator("input[inputmode='numeric']").pressSequentially("3000");
    await submit(add);
    await settled(async () => (await serverDoc()).items.length, 2);
    await button(page, "Add bank details Aiman").click();
    const form = panel(page);
    await expect(form.getByRole("button", { name: /Upload your QR/ })).toBeVisible();
    return form;
  };

  test("a QR picture is read, saved as text and offered to everyone", async ({ page, browser }) => {
    const form = await owedAiman(page);
    await form.locator("input[type=file]").setInputFiles(await qrPicture(DUITNOW));
    await expect(form.getByText("QR added")).toBeVisible();
    await expect(page.getByRole("img", { name: "Payment QR" })).toBeVisible();
    await submit(form);
    await settled(async () => (await serverDoc()).people[3].payQr, DUITNOW);
    expect(JSON.stringify((await getDb()).bill_events)).not.toContain(DUITNOW);
    await expect(button(page, "Bank details Aiman")).toBeVisible();

    const other = await newPhone(browser);
    await openBill(other);
    await button(other, "Bank details Aiman").click();
    const details = sheet(other);
    await expect(details.getByRole("img", { name: "Payment QR" })).toBeVisible();
    await expect(details.getByRole("button", { name: "Copy" })).toHaveCount(0);
    await expect(details.getByRole("img", { name: "AIMAN BIN ALI, Maybank, DuitNow QR" })).toBeVisible();
    await expect(details.getByText("This QR says")).toHaveCount(0);
    await loadReader(other);
    await expect.poll(() => scansAs(other, null)).toBe(DUITNOW);
    const saving = other.waitForEvent("download");
    await other.evaluate(() => Object.defineProperty(navigator, "canShare", { value: undefined }));
    await details.getByRole("button", { name: "Save QR" }).click();
    const saved = await saving;
    expect(saved.suggestedFilename()).toBe("SPLITIN-QR-AIMAN-BIN-ALI.png");
    const picture = await readFile(await saved.path());
    const savedUrl = `data:image/png;base64,${picture.toString("base64")}`;
    expect(await scansAs(other, savedUrl)).toBe(DUITNOW);
    const corners = await other.evaluate(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = Object.assign(document.createElement("canvas"), { width: image.width, height: image.height });
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      return [
        [0, 0],
        [image.width - 1, 0],
        [0, image.height - 1],
        [image.width - 1, image.height - 1],
      ].map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data));
    }, savedUrl);
    for (const [red, , , alpha] of corners) {
      expect(alpha).toBe(255);
      expect(red).toBeLessThan(100);
    }

    await button(page, "Bank details Aiman").click();
    const again = panel(page);
    await expect(again.getByText("QR added")).toBeVisible();
    await again.getByRole("button", { name: "Remove" }).click();
    await expect(again.getByRole("button", { name: /Upload your QR/ })).toBeVisible();
    await submit(again);
    await settled(async () => (await serverDoc()).people[3].payQr ?? null, null);
    await expect(button(page, "Add bank details Aiman")).toBeVisible();
  });

  test("a website QR and a picture with no QR are refused with a clear reason", async ({ page }) => {
    const form = await owedAiman(page);
    const file = form.locator("input[type=file]");
    await file.setInputFiles(await qrPicture("https://example.com/pay"));
    await expect(form.getByText("Invalid QR. Use the QR from your bank or e-wallet app.")).toBeVisible();
    await expect(form.getByText("QR added")).toHaveCount(0);

    await file.setInputFiles({
      name: "blank.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await expect(form.getByText("Invalid QR. Try a clearer screenshot.")).toBeVisible();
    await expect(form.locator("button[type=submit]")).toBeDisabled();
    expect((await serverDoc()).people[3].payQr ?? null).toBeNull();
  });

  test("your own payment shows the QR too, and the QR never reaches the paper", async ({ page }) => {
    await seed({ ...trip, people: [{ ...trip.people[0], payQr: DUITNOW }, ...trip.people.slice(1)] });
    await openAs(page, "Najmi");
    await expect(page.locator("[data-receipt-total]").getByRole("img")).toHaveCount(0);
    await payLine(page, "NAJMI", "HAZIQ").click();
    const ask = sheet(page);
    await expect(ask.getByRole("img", { name: "Payment QR" })).toBeVisible();
    await expect(ask.getByRole("button", { name: "Save QR" })).toBeVisible();
    await expect(ask.getByRole("button", { name: "Mark paid" })).toBeVisible();
  });

  test("a QR whose name has nothing to do with the name on the bill gets a warning", async ({ page }) => {
    await seed({ ...trip, people: [{ ...trip.people[0], payQr: AMIR }, ...trip.people.slice(1)] });
    await openAs(page, "Najmi");
    await payLine(page, "NAJMI", "HAZIQ").click();
    const ask = sheet(page);
    await expect(ask.getByText("This QR says AMIR BIN ZULKIFLI, not Haziq.")).toBeVisible();
    await expect(ask.getByText("Ask Haziq before you pay.")).toBeVisible();
    await expect(ask.getByRole("img", { name: "AMIR BIN ZULKIFLI, TNG eWallet, DuitNow QR" })).toBeVisible();
    await expect(ask.getByRole("button", { name: "Mark paid" })).toBeEnabled();
  });

  test("the bank and account sit on the card, unless the QR is from another bank", async ({ page }) => {
    const hana = { bank: "Maybank", accountNo: "7012 4455", payQr: DUITNOW };
    await seed({ ...trip, people: [{ ...trip.people[0], ...hana }, ...trip.people.slice(1)] });
    await openAs(page, "Najmi");
    await payLine(page, "NAJMI", "HAZIQ").click();
    const same = sheet(page);
    await expect(same.getByRole("img", { name: "Maybank · 7012 4455" })).toBeVisible();
    await expect(same.getByRole("button", { name: "Copy account no." })).toBeVisible();

    await seed({ ...trip, people: [{ ...trip.people[0], ...hana, payQr: AMIR }, ...trip.people.slice(1)] });
    await page.reload();
    await payLine(page, "NAJMI", "HAZIQ").click();
    const other = sheet(page);
    await expect(other.getByRole("img", { name: "AMIR BIN ZULKIFLI, TNG eWallet, DuitNow QR" })).toBeVisible();
    await expect(other.getByText("7012 4455")).toBeVisible();
    await expect(other.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
  });

  test("the wallpaper words reach every side of the card", async ({ page }) => {
    await seed({ ...trip, people: [{ ...trip.people[0], payQr: AMIR }, ...trip.people.slice(1)] });
    await openAs(page, "Najmi");
    await payLine(page, "NAJMI", "HAZIQ").click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const canvas = document.querySelector<HTMLCanvasElement>("canvas[role=img]")!;
          const { width: w, height: h } = canvas;
          const lit = (x: number, y: number, wide: number, tall: number) => {
            const { data } = canvas.getContext("2d")!.getImageData(x, y, wide, tall);
            let count = 0;
            for (let i = 0; i < data.length; i += 4) if (data[i] === 0x3f && data[i + 1] === 0xc3) count++;
            return count;
          };
          return [
            lit(0, 0, w, 100),
            lit(0, h - 100, w, 100),
            lit(0, h / 2, 100, h / 2),
            lit(w - 100, h / 2, 100, h / 2),
          ].every((count) => count > 500);
        }),
      )
      .toBe(true);
  });

  test("the pay sheet has one main button and closes by tapping outside", async ({ page }) => {
    const hana = { bank: "Maybank", accountNo: "7012 4455", payQr: DUITNOW };
    await seed({ ...trip, people: [{ ...trip.people[0], ...hana }, ...trip.people.slice(1)] });
    await openAs(page, "Najmi");
    await payLine(page, "NAJMI", "HAZIQ").click();
    const ask = sheet(page);
    await expect(ask.getByRole("button", { name: "Mark paid" })).toBeVisible();
    await expect(ask.getByRole("button", { name: "Change ›" })).toBeVisible();
    await expect(ask.getByRole("button", { name: "Copy account no." })).toBeVisible();
    await expect(ask.getByRole("button", { name: "Save QR" })).toBeVisible();
    await expect(ask.getByRole("button")).toHaveCount(4);
    await page.touchscreen.tap(195, 20);
    await expect(sheet(page)).toHaveCount(0);
  });

  test("Mark paid can still be reached under the QR card on a small phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await seed({ ...trip, people: [{ ...trip.people[0], payQr: AMIR }, ...trip.people.slice(1)] });
    await openAs(page, "Najmi");
    await payLine(page, "NAJMI", "HAZIQ").click();
    const paid = sheet(page).getByRole("button", { name: "Mark paid" });
    await paid.scrollIntoViewIfNeeded();
    await expect(paid).toBeInViewport();
    expect(
      await sheet(page)
        .locator(".overflow-y-auto")
        .evaluate((el) => el.scrollTop),
    ).toBeGreaterThan(0);
    await expect(sheet(page).getByRole("heading")).toBeInViewport();
  });

  test("the title and close button stay at the top while the form scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 560 });
    const form = await owedAiman(page);
    const title = form.getByText("Bank details", { exact: true });
    const close = form.getByRole("button", { name: "Cancel" });
    const before = await title.boundingBox();
    expect((await close.boundingBox())!.y - (await form.boundingBox())!.y).toBeLessThan(20);
    await form.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect.poll(() => form.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await title.boundingBox()).toEqual(before);
    await close.click();
    await expect(form).toHaveCount(0);
  });

  test("whoever is on a name can add and change its bank details", async ({ browser }) => {
    await seed({ ...trip, items: [{ ...dinner, paidBy: "n" }] });
    const first = await newPhone(browser);
    const second = await newPhone(browser);
    const other = await newPhone(browser);
    await openAs(first, "Najmi");
    await openAs(second, "Najmi");
    await openAs(other, "Afiq");
    await expect(other.getByRole("button", { name: "Menu", exact: true })).toBeVisible();
    await expect(button(other, /bank details Najmi/i)).toHaveCount(0);

    await button(first, "Add bank details Najmi").click();
    const adding = panel(first);
    await adding.getByRole("button", { name: "Maybank" }).click();
    await adding.locator("input[inputmode='numeric']").fill("1111");
    await submit(adding);
    await settled(async () => (await serverDoc()).people[1].accountNo, "1111");

    await second.reload();
    await button(second, "Bank details Najmi").click();
    const fixing = panel(second);
    const account = fixing.locator("input[inputmode='numeric']");
    await expect(account).toHaveValue("1111");
    await account.fill("2222");
    await submit(fixing);
    await settled(async () => (await serverDoc()).people[1].accountNo, "2222");

    await other.reload();
    await button(other, "Bank details Najmi").click();
    await expect(sheet(other).getByText("2222")).toBeVisible();
    await expect(panel(other)).toHaveCount(0);
    expect((await eventKinds()).filter((kind) => kind === "person_details")).toHaveLength(2);
  });

  test("details the owner typed in can't be replaced by picking the name", async ({ page }) => {
    await seed({
      ...trip,
      people: [trip.people[0], { ...trip.people[1], bank: "Maybank", accountNo: "7012" }, trip.people[2]],
      items: [{ ...dinner, paidBy: "n" }],
    });
    await openAs(page, "Najmi");
    await button(page, "Bank details Najmi").click();
    await expect(sheet(page).getByText("7012")).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
  });

  test("Pay to only lists people who are owed and have something to show", async ({ page }) => {
    await seed({
      ...trip,
      people: [{ ...trip.people[0], bank: "Maybank", accountNo: "7012" }, trip.people[1], trip.people[2]],
      items: [hotel, dinner],
    });
    await openBill(page);
    await expect(button(page, "Bank details Haziq")).toBeVisible();
    await expect(button(page, /Bank details (Najmi|Afiq)/)).toHaveCount(0);
    await seed({ ...trip, items: [hotel] });
    await openBill(page);
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeVisible();
    await expect(page.getByText("PAY TO", { exact: true })).toHaveCount(0);
  });

  test("your own payment shows where to pay, above Mark paid", async ({ page }) => {
    await seed({
      ...trip,
      people: [{ ...trip.people[0], bank: "Maybank", accountNo: "7012 4455" }, ...trip.people.slice(1)],
    });
    await openAs(page, "Najmi");
    await payLine(page, "NAJMI", "HAZIQ").click();
    const ask = sheet(page);
    await expect(ask.getByText("7012 4455")).toBeVisible();
    await expect(ask.getByRole("button", { name: "Copy" })).toBeVisible();
    await expect(ask.getByRole("button", { name: "Mark paid" })).toBeVisible();
  });
});

test.describe("adding a bill", () => {
  test("a member adds what they paid, and can undo", async ({ page }) => {
    await openBill(page);
    const form = await startAdding(page, "Petrol", "6000", "Najmi");
    await expect(form.locator("input[inputmode='numeric']")).toHaveValue("60.00");
    await submit(form);
    await expect(text(page, "PETROL")).toBeVisible();
    await settled(itemNames, ["Hotel", "Petrol"]);
    const petrol = (await serverDoc()).items[1];
    expect(petrol.addedAt).toBeTruthy();
    expect((await getDb()).bills[0].rights.items?.[petrol.id]).toBeTruthy();

    await button(page, "Undo").click();
    await settled(itemNames, ["Hotel"]);
    await expect(text(page, "PETROL")).toHaveCount(0);
  });

  test("the payer must be chosen first when the name is unknown", async ({ page }) => {
    await seed({ ...trip, ownerId: null });
    await openBill(page);
    await choose(page, "Add bill");
    await addName(page, "Aiman");
    const form = panel(page);
    await form.getByRole("button", { name: "Aiman", pressed: true }).click();
    await expect(form.getByRole("button", { name: "Aiman", pressed: true })).toBeVisible();
    await form.locator("input[maxlength='60']").fill("Toll");
    await form.locator("input[inputmode='numeric']").pressSequentially("500");
    await expect(form.locator("button[type=submit]")).toBeEnabled();
  });

  test("+ Add puts a new name on the bill, saved only with the bill", async ({ page }) => {
    await openBill(page);
    const form = await startAdding(page, "Snacks", "3000", "Najmi");
    await form.getByRole("button", { name: "+ Add" }).click();
    await form.getByPlaceholder("Name").fill("Siti");
    await form.getByRole("button", { name: "Add", exact: true }).click();
    await expect(form.getByRole("button", { name: "Siti" }).first()).toBeVisible();
    expect(await names()).toEqual(["Haziq", "Najmi", "Afiq"]);

    await submit(form);
    await settled(names, ["Haziq", "Najmi", "Afiq", "Siti"]);
    const snacks = (await serverDoc()).items[1];
    expect(snacks.participants).toHaveLength(4);
    expect(await eventKinds()).toEqual(expect.arrayContaining(["person_added", "item_added"]));
  });

  test("+ Add cannot add a duplicate name", async ({ page }) => {
    await openBill(page);
    const form = await startAdding(page, "Snacks", "3000", "Najmi");
    await form.getByRole("button", { name: "+ Add" }).click();
    await form.getByPlaceholder("Name").fill("afiq");
    await form.getByRole("button", { name: "Add", exact: true }).click();
    await expect(text(page, "afiq is already in the list")).toBeVisible();
  });

  test("a later bill has everyone ticked, including someone who joined only one bill", async ({ page }) => {
    await patchDoc((d) => ({ ...d, items: [hotel, dinner] }));
    await openBill(page);
    await joinAs(page, "Aiman");
    await settled(async () => (await serverItem("hotel"))?.participants.length, 4);
    await page.keyboard.press("Escape");

    await submit(await startAdding(page, "Toll", "500"));
    await settled(async () => (await serverDoc()).items.length, 3);
    expect((await serverDoc()).items[2].participants).toHaveLength(4);
  });

  test("members delete only their own bills", async ({ browser }) => {
    const mine = await newPhone(browser);
    const stranger = await newPhone(browser);
    await openBill(mine);
    await submit(await startAdding(mine, "Snacks", "1000", "Najmi"));
    await settled(itemNames, ["Hotel", "Snacks"]);

    await openAs(stranger, "Afiq");
    await openBillDetail(stranger, "Snacks");
    await expect(menuCard(stranger).getByText("Najmi paid RM 10.00", { exact: false })).toBeVisible();
    await expect(menuCard(stranger).getByRole("button", { name: "Edit bill" })).toHaveCount(0);

    await openBillDetail(mine, "Snacks");
    await panel(mine).getByRole("button", { name: "Delete bill · you can undo" }).click();
    await settled(itemNames, ["Hotel"]);
    await button(mine, "Undo").click();
    await settled(itemNames, ["Hotel", "Snacks"]);
  });

  test("two members adding at the same moment both survive", async ({ browser }) => {
    const a = await newPhone(browser);
    const b = await newPhone(browser);
    await openBill(a);
    await openBill(b);
    const first = await startAdding(a, "Snacks", "1000", "Najmi");
    const second = await startAdding(b, "Parking", "2000", "Afiq");
    await Promise.all([submit(first), submit(second)]);
    await settled(async () => (await itemNames()).sort(), ["Hotel", "Parking", "Snacks"]);
  });
});

test.describe("secret keys", () => {
  test("stay on the server, whoever opens the bill", async ({ browser, page }) => {
    await seed({ ...trip, items: [hotel, dinner] });
    await openBill(page);
    await joinAs(page, "Aiman");
    await settled(async () => Boolean((await serverItem("hotel"))?.joins), true);
    await openBill(page);
    await submit(await startAdding(page, "Petrol", "6000"));
    await settled(itemNames, ["Hotel", "Dinner", "Petrol"]);

    const { doc, rights } = (await getDb()).bills[0];
    const aiman = doc.people.find((p) => p.name === "Aiman")!;
    const petrol = doc.items.find((i) => i.name === "Petrol")!;
    const hashes = [rights.people![aiman.id], rights.items![petrol.id], rights.joins!.hotel[aiman.id]];
    for (const hash of hashes) expect(hash).toMatch(/^[0-9a-f]{64}$/);

    const stranger = await newPhone(browser);
    await openBill(stranger);
    await expect(text(stranger, "PETROL")).toBeVisible();
    const html = await stranger.content();
    const owner = await newPhone(browser, ownerStorage());
    await owner.goto("/");
    await expect(text(owner, "PETROL")).toBeVisible();
    const draft = await owner.evaluate(() => localStorage.getItem("splitin:draft:v2")!);
    expect(draft).toContain("Petrol");
    for (const seen of [JSON.stringify(doc), html, draft]) {
      for (const hash of hashes) expect(seen).not.toContain(hash);
      for (const word of ["browser_hash", "browserHash", "owner_token_hash"]) expect(seen).not.toContain(word);
    }
  });

  test("an owner's saved copy cannot add keys", async ({ browser }) => {
    const forged = {
      ...trip,
      people: [{ ...trip.people[0], keyHash: "forged" }, ...trip.people.slice(1)],
      items: [{ ...hotel, addedAt: OLD, deleteHash: "forged" }],
      secrets: { items: { hotel: "forged" } },
    };
    const owner = await newPhone(browser, ownerStorage(forged as typeof trip));
    await owner.goto("/");
    await expect(text(owner, "HOTEL")).toBeVisible();
    await owner.evaluate(() => {
      const draft = JSON.parse(localStorage.getItem("splitin:draft:v2")!);
      draft.doc.title = "Renamed";
      localStorage.setItem("splitin:draft:v2", JSON.stringify(draft));
      window.dispatchEvent(new Event("storage"));
    });
    await settled(async () => (await serverDoc()).title, "Renamed");
    const { doc, rights } = (await getDb()).bills[0];
    expect(JSON.stringify(doc)).not.toContain("forged");
    expect(rights).toEqual({ people: {}, items: {}, joins: {}, payments: {} });
  });
});

test.describe("seeing a change before saving", () => {
  test.beforeEach(() => seed());

  test("a new bill changes the total and who pays who first", async ({ page }) => {
    await openBill(page);
    const form = await startAdding(page, "Snacks", "3000", "Najmi");
    await expect(text(page, "RM 330.00")).toBeVisible();
    await expect(text(page, "RM 110.00")).toBeVisible();
    expect(await itemNames()).toEqual(["Hotel"]);

    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(text(page, "RM 300.00")).toBeVisible();
    expect(await itemNames()).toEqual(["Hotel"]);
  });

  test("a different amount shows as paid, with the rest still to pay", async ({ page }) => {
    await openAs(page, "Najmi");
    await payLine(page, "NAJMI", "HAZIQ").click();
    await sheet(page).getByRole("button", { name: "Change ›" }).click();
    const form = panel(page);
    await form.locator("input[inputmode='numeric']").pressSequentially("4000");
    await expect(page.getByText("PAID", { exact: true })).toBeVisible();
    await expect(page.getByText("60.00", { exact: true })).toBeVisible();
    expect(await paymentsOf()).toEqual([]);

    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("PAID", { exact: true })).toHaveCount(0);
    expect(await paymentsOf()).toEqual([]);
  });

  test("Share waits until the form is closed, so nothing unsaved goes out", async ({ page }) => {
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    await openBill(page);
    await expect(menu).toBeVisible();
    const form = await startAdding(page, "Snacks", "3000", "Najmi");
    await expect(menu).toHaveCount(0);
    await expect(button(page, /^Share receipt/)).toHaveCount(0);
    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(menuCard(page).getByRole("button", { name: /^Share receipt/ })).toBeVisible();
  });
});

test.describe("joining bills", () => {
  test.beforeEach(() => seed({ ...trip, items: [hotel, dinner] }));

  const startJoining = async (page: Page, item = "Hotel") => {
    await openBill(page);
    await joinAs(page, "Aiman", item);
  };
  const me = async () => (await serverDoc()).people.find((p) => p.name === "Aiman")!.id;
  const row = (page: Page, item: string) => menuCard(page).getByRole("button", { name: new RegExp(`^${item}`) });
  const amountBox = (page: Page, item: string) => page.getByRole("textbox", { name: `Your amount for ${item}` });

  test("each Join button shows what you would pay", async ({ page }) => {
    await openBill(page);
    await addMe(page, "Aiman");
    await openBills(page);
    await expect(joinButton(page, "Hotel")).toHaveText("Join · RM 75.00");
    await expect(joinButton(page, "Dinner")).toHaveText("Join · RM 22.50");
    expect((await serverItem("hotel"))?.participants).toHaveLength(3);
  });

  test("Join saves at once, and Undo takes it back", async ({ page }) => {
    await startJoining(page);
    await expect(text(page, "Joined Hotel. You pay RM 75.00.")).toBeVisible();
    const id = await me();
    await settled(async () => (await serverItem("hotel"))?.participants.includes(id), true);
    expect((await serverItem("hotel"))?.overrides).toEqual({});
    expect((await serverItem("dinner"))?.participants.includes(id)).toBe(false);
    expect(await eventKinds()).toContain("bill_joined");
    await expect(menuCard(page).getByText("Your share RM 75.00")).toBeVisible();
    await expect(text(page, "75.00 EACH")).toBeAttached();

    await button(page, "Undo").click();
    await settled(async () => (await serverItem("hotel"))?.participants.includes(id), false);
    expect((await serverItem("hotel"))?.joins).toBeUndefined();
    await expect(joinButton(page, "Hotel")).toBeVisible();
  });

  test("your part can be written, and set back to equal", async ({ page }) => {
    await startJoining(page);
    const id = await me();
    await settled(async () => (await serverItem("hotel"))?.participants.includes(id), true);
    await row(page, "Hotel").click();
    const input = amountBox(page, "Hotel");
    await input.fill("");
    await input.pressSequentially("3000");
    await input.press("Enter");
    await expect(text(page, "Saved. Your part of Hotel is RM 30.00.")).toBeVisible();
    await settled(async () => (await serverItem("hotel"))?.overrides[id], 3000);
    expect(await eventKinds()).toContain("share_changed");
    await expect(text(page, "90.00 EACH")).toBeAttached();

    await row(page, "Hotel").click();
    await menuCard(page).getByRole("button", { name: "Split equally again" }).click();
    await expect(text(page, "Hotel is split equally again")).toBeVisible();
    await settled(async () => (await serverItem("hotel"))?.overrides, {});
  });

  test("an amount above the bill is refused", async ({ page }) => {
    await startJoining(page, "Dinner");
    const id = await me();
    await settled(async () => (await serverItem("dinner"))?.participants.includes(id), true);
    await row(page, "Dinner").click();
    const input = amountBox(page, "Dinner");
    await input.fill("");
    await input.pressSequentially("10000");
    await input.press("Enter");
    await expect(text(page, "More than what's left on this bill")).toBeVisible();
    expect((await serverItem("dinner"))?.overrides).toEqual({});
  });

  test("saving the same amount keeps it equal and saves nothing", async ({ page }) => {
    await startJoining(page);
    const id = await me();
    await settled(async () => (await serverItem("hotel"))?.participants.includes(id), true);
    await row(page, "Hotel").click();
    await amountBox(page, "Hotel").press("Enter");
    await expect(menuCard(page).getByText("Your bills", { exact: true })).toBeVisible();
    expect((await serverItem("hotel"))?.overrides).toEqual({});
    expect(await eventKinds()).not.toContain("share_changed");
  });

  test("Leave takes you out of a bill you joined on the same phone", async ({ page }) => {
    await startJoining(page);
    const id = await me();
    await expect(text(page, "Joined Hotel. You pay RM 75.00.")).toBeVisible();
    await settled(async () => (await serverItem("hotel"))?.participants.includes(id), true);
    await row(page, "Hotel").click();
    await menuCard(page).getByRole("button", { name: "Leave Hotel" }).click();
    await expect(text(page, "You left Hotel")).toBeVisible();
    await settled(async () => (await serverItem("hotel"))?.participants.includes(id), false);
    expect(await eventKinds()).toContain("bill_left");
    await expect(joinButton(page, "Hotel")).toBeVisible();
  });

  test("a bill someone else put you in can't be left or changed here", async ({ page }) => {
    await openAs(page, "Najmi");
    await openBills(page);
    await expect(row(page, "Hotel")).toContainText("RM 100.00your part");
    await expect(joinButton(page, "Hotel")).toHaveCount(0);

    await row(page, "Hotel").click();
    const card = menuCard(page);
    await expect(card.getByText("Haziq paid RM 300.00, split between Haziq, you and Afiq.")).toBeVisible();
    await expect(card.getByText("Haziq put you in this bill, so only Haziq can take you out.")).toBeVisible();
    await expect(amountBox(page, "Hotel")).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Leave Hotel" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Edit bill" })).toHaveCount(0);
    expect((await serverItem("hotel"))?.participants).toContain("n");
  });

  test("a bill with every amount set can't be joined", async ({ page }) => {
    await seed({
      ...trip,
      items: [{ ...hotel, participants: ["h", "n"], overrides: { h: 10000, n: 20000 } }, dinner],
    });
    await openBill(page);
    await addMe(page, "Aiman");
    await openBills(page);
    await expect(joinButton(page, "Hotel")).toHaveText("Join");
    await joinButton(page, "Hotel").click();
    await expect(text(page, "Every amount is set. Ask Haziq.")).toBeVisible();
    await expect(joinButton(page, "Hotel")).toBeVisible();
  });

  test("someone who already paid too much gets paid back", async ({ page }) => {
    await seed(trip, { payments: [paymentRow("n", "h", 10000)] });
    await startJoining(page);
    await page.keyboard.press("Escape");
    await expect(menuCard(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /PAYS NAJMI 25\.00/ })).toBeVisible();
  });

  test("the part box stays 16px so iPhone does not zoom, and fits on screen", async ({ page }) => {
    await startJoining(page);
    const id = await me();
    await settled(async () => (await serverItem("hotel"))?.participants.includes(id), true);
    await row(page, "Hotel").click();
    const input = amountBox(page, "Hotel");
    expect(await input.evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
    const box = (await menuCard(page).boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  });
});

test.describe("paying", () => {
  test("only your own payments can be tapped", async ({ page }) => {
    await openAs(page, "Najmi");
    await expect(text(page, "Paid? Tap your payment below to mark it.")).toBeVisible();
    await expect(payLine(page, "NAJMI", "HAZIQ")).toBeVisible();
    await expect(payLine(page, "AFIQ", "HAZIQ")).toHaveCount(0);

    await payLine(page, "NAJMI", "HAZIQ").click();
    await expect(sheet(page).getByRole("heading", { name: "Najmi paid Haziq?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Are you/ })).toHaveCount(0);
  });

  test("only the arrow moves on what you can tap", async ({ page }) => {
    const animation = (el: Element) => getComputedStyle(el).animationName;
    await openBill(page);
    const hint = button(page, "Paid? Tap to pick your name");
    expect(await hint.getByText("›").evaluate(animation)).toBe("arrow");
    expect(await hint.evaluate(animation)).toBe("none");

    await hint.click();
    await pickMe(page, "Najmi");
    const line = payLine(page, "NAJMI", "HAZIQ");
    await expect(line).toBeVisible();
    expect(await line.getByText("›").evaluate(animation)).toBe("arrow");
    expect(await line.evaluate(animation)).toBe("none");
  });

  test("Just looking cannot tap a payment until a name is chosen", async ({ page }) => {
    await openBill(page);
    await expect(button(page, "Paid? Tap to pick your name")).toBeVisible();
    await expect(payLine(page, "NAJMI", "HAZIQ")).toHaveCount(0);
    await expect(payLine(page, "AFIQ", "HAZIQ")).toHaveCount(0);

    await button(page, "Paid? Tap to pick your name").click();
    await pickMe(page, "Afiq");
    await expect(payLine(page, "AFIQ", "HAZIQ")).toBeVisible();
    await expect(payLine(page, "NAJMI", "HAZIQ")).toHaveCount(0);
    await expect(text(page, "Paid? Tap your payment below to mark it.")).toBeVisible();
  });

  test("changing your name changes which payments can be tapped", async ({ page }) => {
    await openAs(page, "Najmi");
    await expect(payLine(page, "NAJMI", "HAZIQ")).toBeVisible();
    await button(page, "Hi Najmi").click();
    await pickMe(page, "Afiq");
    await expect(payLine(page, "AFIQ", "HAZIQ")).toBeVisible();
    await expect(payLine(page, "NAJMI", "HAZIQ")).toHaveCount(0);
  });

  test("with nothing left to pay, the hint goes away", async ({ page }) => {
    await seed(trip, { payments: [paymentRow("n", "h", 10000)] });
    await openAs(page, "Najmi");
    await expect(text(page, "HOTEL")).toBeVisible();
    await expect(page.getByText("Paid? ")).toHaveCount(0);
  });

  test("a member cannot mark the owner's own payment", async ({ page }) => {
    await seed({ ...trip, items: [{ ...hotel, paidBy: "a" }] });
    await openAs(page, "Najmi");
    await expect(payLine(page, "NAJMI", "AFIQ")).toBeVisible();
    await expect(payLine(page, "HAZIQ", "AFIQ")).toHaveCount(0);
  });

  test("marks a payment and can undo it", async ({ page }) => {
    await openAs(page, "Najmi");
    await payLine(page, "NAJMI", "HAZIQ").click();
    await sheet(page).getByRole("button", { name: "Mark paid" }).click();
    await settled(paymentsOf, [{ from: "n", to: "h", amountMinor: 10000 }]);
    await button(page, "Undo").click();
    await settled(paymentsOf, []);
  });

  test.describe("undoing later", () => {
    const paid = { from: "n", to: "h", amountMinor: 10000 };
    const markPaid = async (page: Page) => {
      await payLine(page, "NAJMI", "HAZIQ").click();
      await sheet(page).getByRole("button", { name: "Mark paid" }).click();
      await settled(paymentsOf, [paid]);
    };
    const stamp = (page: Page) => page.getByText("PAID", { exact: true }).first();

    test("the phone that marked it can undo it, with no time limit", async ({ page }) => {
      await openAs(page, "Najmi");
      await markPaid(page);

      await changePayments({ created_at: new Date(Date.now() - 20 * 86_400_000).toISOString() });
      await page.reload();

      const line = button(page, /NAJMI PAYS HAZIQ 100\.00 PAID/);
      await expect(stamp(page)).toBeVisible();
      expect(await line.getByText("›").evaluate((el) => getComputedStyle(el).animationName)).toBe("arrow");
      await line.click();
      await expect(sheet(page).getByRole("heading", { name: "Not paid Haziq after all?" })).toBeVisible();
      await sheet(page).getByRole("button", { name: "Cancel" }).click();
      await expect(sheet(page)).toHaveCount(0);
      expect(await paymentsOf()).toEqual([paid]);

      await line.click();
      await sheet(page).getByRole("button", { name: "Mark unpaid" }).click();
      await settled(paymentsOf, []);
      await expect(text(page, "Najmi → Haziq is unpaid again")).toBeVisible();
      await expect(button(page, /NAJMI PAYS HAZIQ 100\.00$/)).toBeVisible();

      const list = await openHistory(page);
      await expect(list.getByText("Najmi undid their payment to Haziq")).toBeVisible();
    });

    test("the toast's Undo takes it back", async ({ page }) => {
      await openAs(page, "Najmi");
      await markPaid(page);
      await button(page, "Undo").click();
      await settled(paymentsOf, []);
      await expect(text(page, "Najmi → Haziq is unpaid again")).toBeVisible();
      await expect(button(page, /NAJMI PAYS HAZIQ 100\.00$/)).toBeVisible();
    });

    test("another phone, or another name on this phone, cannot undo it", async ({ page, browser }) => {
      await openAs(page, "Najmi");
      await markPaid(page);

      const other = await newPhone(browser, { [`splitin:me:${BILL}`]: "n" });
      await openFresh(other);
      await expect(stamp(other)).toBeVisible();
      await expect(payLine(other, "NAJMI", "HAZIQ")).toHaveCount(0);

      await button(page, "Hi Najmi").click();
      await pickMe(page, "Afiq");
      await expect(payLine(page, "NAJMI", "HAZIQ")).toHaveCount(0);
      await button(page, "Hi Afiq").click();
      await pickMe(page, "Najmi");
      await expect(payLine(page, "NAJMI", "HAZIQ")).toBeVisible();
    });

    for (const byRole of ["owner", "member"])
      test(`a payment marked by ${byRole} on another phone stays as it is`, async ({ page }) => {
        await seed(trip, { payments: [paymentRow("n", "h", 10000, byRole)] });
        await openAs(page, "Najmi");
        await expect(stamp(page)).toBeVisible();
        await expect(payLine(page, "NAJMI", "HAZIQ")).toHaveCount(0);
      });

    test("the PAID stamp stays clear of a big amount", async ({ page }) => {
      await seed({ ...trip, items: [{ ...hotel, amountMinor: 370000 }] }, { payments: [paymentRow("n", "h", 123333)] });
      await openAs(page, "Najmi");
      const stampBox = await stamp(page).boundingBox();
      const amountBox = await page.getByText("1,233.33", { exact: true }).first().boundingBox();
      expect(stampBox!.x + stampBox!.width).toBeLessThanOrEqual(amountBox!.x);
    });

    test("the server refuses a different browser", async ({ page }) => {
      await openAs(page, "Najmi");
      await markPaid(page);
      await page.waitForTimeout(1000);
      await payLine(page, "NAJMI", "HAZIQ").click();
      await page.context().addCookies([{ name: "splitin-browser", value: "another", url: "http://localhost:3457" }]);
      await sheet(page).getByRole("button", { name: "Mark unpaid" }).click();
      await expect(text(page, "Something went wrong")).toBeVisible();
      expect(await paymentsOf()).toEqual([paid]);
    });

    test("the server refuses when the owner has taken over the payment", async ({ page }) => {
      await openAs(page, "Najmi");
      await markPaid(page);
      await changePayments({ by_role: "owner" });
      await payLine(page, "NAJMI", "HAZIQ").click();
      await sheet(page).getByRole("button", { name: "Mark unpaid" }).click();
      await expect(text(page, "Something went wrong")).toBeVisible();
      expect(await paymentsOf()).toEqual([paid]);
    });

    test("a payment the owner already undid just clears", async ({ page }) => {
      await openAs(page, "Najmi");
      await markPaid(page);
      await page.waitForTimeout(1000);
      await payLine(page, "NAJMI", "HAZIQ").click();
      await clearPayments();
      await sheet(page).getByRole("button", { name: "Mark unpaid" }).click();
      await expect(text(page, "Najmi → Haziq is unpaid again")).toBeVisible();
      await expect(button(page, /NAJMI PAYS HAZIQ 100\.00$/)).toBeVisible();
    });

    test("a part payment can be undone while the rest stays open", async ({ page }) => {
      await openAs(page, "Najmi");
      await payLine(page, "NAJMI", "HAZIQ").click();
      await sheet(page).getByRole("button", { name: "Change ›" }).click();
      const form = panel(page);
      await form.locator("input[inputmode='numeric']").pressSequentially("6000");
      await submit(form);
      await settled(paymentsOf, [{ ...paid, amountMinor: 6000 }]);

      await button(page, /NAJMI PAYS HAZIQ 40\.00$/).click();
      await expect(sheet(page).getByRole("heading", { name: "Najmi paid Haziq?" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet(page)).toHaveCount(0);

      await button(page, /NAJMI PAYS HAZIQ 60\.00 PAID/).click();
      await sheet(page).getByRole("button", { name: "Mark unpaid" }).click();
      await settled(paymentsOf, []);
      await expect(button(page, /NAJMI PAYS HAZIQ 100\.00$/)).toBeVisible();
    });

    test("still works on a locked bill", async ({ page }) => {
      await openAs(page, "Najmi");
      await markPaid(page);
      await patchDoc((d) => ({ ...d, locked: true }));
      await page.reload();
      await payLine(page, "NAJMI", "HAZIQ").click();
      await sheet(page).getByRole("button", { name: "Mark unpaid" }).click();
      await settled(paymentsOf, []);
    });
  });

  test("a different amount is recorded and the receipt works out the rest", async ({ page }) => {
    await openAs(page, "Najmi");
    await payLine(page, "NAJMI", "HAZIQ").click();
    await sheet(page).getByRole("button", { name: "Change ›" }).click();
    const form = panel(page);
    await expect(form.getByText("Record a payment")).toBeVisible();
    await expect(form.getByText("Najmi → Haziq")).toBeVisible();
    await expect(form.getByRole("button", { name: "Najmi" })).toHaveCount(0);
    await expect(form.getByRole("button", { name: "Haziq" })).toHaveCount(0);
    await form.locator("input[inputmode='numeric']").pressSequentially("6000");
    await submit(form);
    await settled(paymentsOf, [{ from: "n", to: "h", amountMinor: 6000 }]);
    await expect(page.getByRole("button", { name: /NAJMI PAYS HAZIQ.*40\.00/ })).toBeVisible();
  });

  test("the server refuses a different amount between people not on an open payment", async ({ page }) => {
    await openAs(page, "Najmi");
    await payLine(page, "NAJMI", "HAZIQ").click();
    await sheet(page).getByRole("button", { name: "Change ›" }).click();
    const form = panel(page);
    await form.locator("input[inputmode='numeric']").pressSequentially("6000");
    await page.route("**/bill/**", async (route) => {
      const body = route.request().postData();
      if (route.request().method() === "POST" && body?.includes('"different":true')) {
        await route.continue({ postData: body.replace('"to":"h"', '"to":"a"') });
      } else await route.continue();
    });
    await submit(form);
    await expect(text(page, "Something went wrong")).toBeVisible();
    expect(await paymentsOf()).toEqual([]);
  });

  test("the receipt line with the wrong amount cannot be marked from a stale page", async ({ page }) => {
    await openAs(page, "Najmi");
    await payLine(page, "NAJMI", "HAZIQ").click();
    await patchDoc((d) => ({ ...d, items: [{ ...hotel, amountMinor: 45000 }] }));
    await sheet(page).getByRole("button", { name: "Mark paid" }).click();
    await expect(text(page, "Something went wrong")).toBeVisible();
    await settled(paymentsOf, []);
  });

  test("the server refuses the toast's Undo from a different browser", async ({ page }) => {
    await openAs(page, "Najmi");
    await payLine(page, "NAJMI", "HAZIQ").click();
    await sheet(page).getByRole("button", { name: "Mark paid" }).click();
    await settled(paymentsOf, [{ from: "n", to: "h", amountMinor: 10000 }]);

    await page.context().addCookies([{ name: "splitin-browser", value: "another", url: "http://localhost:3457" }]);
    await button(page, "Undo").click();
    await page.waitForTimeout(1500);
    expect(await paymentsOf()).toEqual([{ from: "n", to: "h", amountMinor: 10000 }]);
  });

  test("History names the person paying", async ({ page }) => {
    await openAs(page, "Afiq");
    await payLine(page, "AFIQ", "HAZIQ").click();
    await sheet(page).getByRole("button", { name: "Mark paid" }).click();
    await settled(paymentsOf, [{ from: "a", to: "h", amountMinor: 10000 }]);
    const list = await openHistory(page);
    await expect(list.getByText("Afiq paid Haziq")).toBeVisible();
  });
});

test.describe("locked and limited", () => {
  test("a locked bill can only have payments marked", async ({ page }) => {
    await seed({ ...trip, locked: true });
    await openFresh(page);
    await expect(sheet(page).getByRole("button", { name: "Not on the list" })).toHaveCount(0);
    await pickMe(page, "Najmi");
    await expect(text(page, "Haziq locked this bill. You can still mark payments.")).toBeVisible();
    await expect(button(page, "Add bill")).toHaveCount(0);

    await payLine(page, "NAJMI", "HAZIQ").click();
    await sheet(page).getByRole("button", { name: "Mark paid" }).click();
    await settled(paymentsOf, [{ from: "n", to: "h", amountMinor: 10000 }]);
  });

  test("locking while a member has the form open refuses the save", async ({ page }) => {
    await openBill(page);
    const form = await startAdding(page, "Snacks", "1000", "Najmi");
    await patchDoc((d) => ({ ...d, locked: true }));
    await submit(form);
    await expect(text(page, "This bill is locked. You can still mark payments.")).toBeVisible();
    expect(await itemNames()).toEqual(["Hotel"]);
  });

  test("too many member changes on one bill are refused", async ({ page }) => {
    const bill_events = Array.from({ length: 100 }, () => ({
      id: crypto.randomUUID(),
      bill_id: BILL,
      kind: "item_added",
      by_role: "member",
      data: { name: "x", amountMinor: 1, payer: "x" },
      created_at: new Date().toISOString(),
    }));
    await seed(trip, { bill_events });
    await openBill(page);
    await submit(await startAdding(page, "Snacks", "1000", "Najmi"));
    await expect(text(page, "Too many changes on this bill")).toBeVisible();
    expect(await itemNames()).toEqual(["Hotel"]);
  });
});

test.describe("telling the group", () => {
  test("offers to share after a change through the phone's share menu, and can be dismissed", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          (window as unknown as { shared: ShareData }).shared = data;
        },
      });
    });
    await openBill(page);
    await submit(await startAdding(page, "Snacks", "1000", "Najmi"));
    await expect(text(page, "The amounts changed. Tell the group?")).toBeVisible();
    await expect(button(page, "WhatsApp")).toHaveCount(0);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const shared = await page.evaluate(() => (window as unknown as { shared: ShareData }).shared.text!);
    expect(shared).toContain("Najmi updated Trip");
    expect(shared.endsWith(`/bill/${BILL}`)).toBe(true);
    await expect(page.getByText("The amounts changed. Tell the group?")).toHaveCount(0);
  });

  test("without a share menu, the message is copied instead", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
    await openBill(page);
    await submit(await startAdding(page, "Snacks", "1000", "Najmi"));
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(text(page, "Copied")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Najmi updated Trip");
  });

  test("shows changes since the last visit, without counting your own", async ({ browser }) => {
    const me = await newPhone(browser);
    const other = await newPhone(browser);
    await openBill(me);
    await submit(await startAdding(me, "Mine", "1000", "Najmi"));
    await settled(itemNames, ["Hotel", "Mine"]);

    const dot = me.locator("[data-menu-button] > i");
    await openBill(me);
    await expect(me.getByRole("button", { name: "Menu", exact: true })).toBeVisible();
    await expect(dot).toHaveCount(0);

    await openBill(other);
    await submit(await startAdding(other, "Theirs", "2000", "Afiq"));
    await settled(itemNames, ["Hotel", "Mine", "Theirs"]);

    await openBill(me);
    await expect(dot).toBeVisible();
    await openHistory(me);
    await expect(sheet(me).getByText(/Afiq added Theirs/)).toBeVisible();

    await openBill(me);
    await expect(me.getByRole("button", { name: "Menu", exact: true })).toBeVisible();
    await expect(dot).toHaveCount(0);
  });

  test("your own change is still yours after your name changes", async ({ browser }) => {
    const me = await newPhone(browser);
    await openBill(me);
    await submit(await startAdding(me, "Mine", "1000", "Najmi"));
    await settled(itemNames, ["Hotel", "Mine"]);
    await patchDoc((doc) => ({
      ...doc,
      people: doc.people.map((p) => (p.id === "n" ? { ...p, name: "Najmi Ali" } : p)),
    }));
    await openBill(me);
    await expect(button(me, "Hi Najmi Ali")).toBeVisible();
    await expect(me.getByText(/since your last visit/)).toHaveCount(0);
  });

  test("a bill with no changes yet says so", async ({ page }) => {
    await openBill(page);
    const list = await openHistory(page);
    await expect(list.getByText("No changes recorded yet")).toBeVisible();
  });
});
