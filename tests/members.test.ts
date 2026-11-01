import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import QRCode from "qrcode";
import {
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
  newPhone,
  OLD,
  openAs,
  openBill,
  openFresh,
  openHistory,
  openJoin,
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
    await expect(button(page, "Add bill")).toBeVisible();
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
    await submit(await startAdding(page, "Snacks", "1000"));
    await expect(button(page, "Delete Snacks")).toBeVisible();

    await button(page, "Hi Najmi").click();
    const list = sheet(page);
    await expect(list.getByRole("button", { name: "Afiq" })).toBeVisible();
    await expect(list.getByRole("button", { name: "Najmi" })).toHaveCount(0);
    await list.getByRole("button", { name: "Just looking" }).click();

    await expect(button(page, "Hi Najmi")).toHaveCount(0);
    await expect(button(page, "Paid? Tap to pick your name")).toBeVisible();
    await expect(button(page, "Delete Snacks")).toHaveCount(0);
    expect(await page.evaluate((id) => localStorage.getItem(`splitin:me:${id}`), BILL)).toBeNull();

    await button(page, "Who are you?").click();
    await expect(sheet(page).getByRole("button", { name: "Najmi" })).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: "Just looking" })).toHaveCount(0);
  });

  test("the name and History sit above the receipt, with Add and Share in a flat bar", async ({ page }) => {
    await openAs(page, "Najmi");
    await expect(button(page, "Add bill")).toBeVisible();
    await expect(button(page, "Share receipt")).toBeVisible();
    await expect(button(page, /^History/)).toBeVisible();

    const name = (await button(page, "Hi Najmi").boundingBox())!;
    const paper = (await text(page, "HOTEL").boundingBox())!;
    const history = (await button(page, /^History/).boundingBox())!;
    expect(name.y).toBeLessThan(paper.y);
    expect(history.y).toBeLessThan(paper.y);
    expect(Math.abs(history.y - name.y)).toBeLessThan(4);

    const main = button(page, "Add bill");
    const bar = (await main.locator("../..").boundingBox())!;
    expect([bar.x, bar.width, bar.y + bar.height]).toEqual([0, 390, 844]);
    expect(await main.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
  });

  test("a bill someone else put you in has no word beside it", async ({ page }) => {
    await openAs(page, "Najmi");
    await expect(button(page, "Add bill")).toBeVisible();
    await expect(button(page, /(Join|Change|Delete) Hotel/)).toHaveCount(0);
  });

  test("before a name is chosen, the top asks who you are and the paper has no words", async ({ page }) => {
    await openBill(page);
    await expect(button(page, "Who are you?")).toBeVisible();
    await expect(button(page, "Add bill")).toBeVisible();
    await expect(button(page, /(Join|Change|Delete) Hotel/)).toHaveCount(0);
  });

  test("Add bill and Join open their forms straight away", async ({ page }) => {
    await seed({ ...trip, items: [hotel, { ...dinner, participants: ["h", "a"] }] });
    await openAs(page, "Najmi");
    await button(page, "Add bill").click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(panel(page).getByText("Add what you paid")).toBeVisible();
    await panel(page).getByRole("button", { name: "Cancel" }).click();

    await button(page, "Join Dinner").click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(panel(page).getByText("Which bills are you in?")).toBeVisible();
    await expect(panel(page).getByRole("checkbox", { name: "Dinner" })).toHaveAttribute("aria-checked", "true");
  });

  test("with no bills yet the button only adds", async ({ page }) => {
    await seed({ ...trip, items: [] });
    await openBill(page);
    await button(page, "Add bill").click();
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
    await button(page, "Add bill").click();
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
    await expect(form.getByText("That isn't a payment QR.", { exact: false })).toBeVisible();
    await expect(form.getByText("QR added")).toHaveCount(0);

    await file.setInputFiles({
      name: "blank.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await expect(form.getByText("We couldn't find a QR in that picture.", { exact: false })).toBeVisible();
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
  });

  test("whoever is on a name can add and change its bank details", async ({ browser }) => {
    await seed({ ...trip, items: [{ ...dinner, paidBy: "n" }] });
    const first = await newPhone(browser);
    const second = await newPhone(browser);
    const other = await newPhone(browser);
    await openAs(first, "Najmi");
    await openAs(second, "Najmi");
    await openAs(other, "Afiq");
    await expect(button(other, "Add bill")).toBeVisible();
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
    await expect(button(page, "Add bill")).toBeVisible();
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
    await submit(await joinAs(page, "Aiman"));
    await settled(async () => (await serverItem("hotel"))?.participants.length, 4);

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
    await expect(button(stranger, "Add bill")).toBeVisible();
    await expect(button(stranger, "Delete Snacks")).toHaveCount(0);

    await button(mine, "Delete Snacks").click();
    await settled(itemNames, ["Hotel"]);
    await expect(button(mine, "Delete Snacks")).toHaveCount(0);
    await button(mine, "Undo").click();
    await settled(itemNames, ["Hotel", "Snacks"]);
    await expect(button(mine, "Delete Snacks")).toBeVisible();
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
    await submit(await joinAs(page, "Aiman"));
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
    await openBill(page);
    await expect(button(page, "Share receipt")).toBeVisible();
    const form = await startAdding(page, "Snacks", "3000", "Najmi");
    await expect(button(page, "Share receipt")).toHaveCount(0);
    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(button(page, "Share receipt")).toBeVisible();
  });
});

test.describe("joining bills", () => {
  test.beforeEach(() => seed({ ...trip, items: [hotel, dinner] }));

  const startJoining = async (page: import("@playwright/test").Page, item = "Hotel") => {
    await openBill(page);
    return joinAs(page, "Aiman", item);
  };
  const me = async () => (await serverDoc()).people.find((p) => p.name === "Aiman")!.id;

  test("tapping Join shows on the receipt at once, and nothing saves until Save", async ({ page }) => {
    const form = await startJoining(page);
    await expect(text(page, "75.00 EACH")).toBeVisible();
    await expect(page.getByText("AIMAN", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /PAYS/ })).toHaveCount(0);
    expect(await me()).toBeTruthy();
    expect((await serverItem("hotel"))?.participants).toHaveLength(3);

    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(text(page, "100.00 EACH")).toBeVisible();
    await expect(page.getByText("AIMAN", { exact: true })).toHaveCount(0);
    expect((await serverItem("hotel"))?.participants).toHaveLength(3);
  });

  test("a typed amount shows on the receipt, and Save keeps it", async ({ page }) => {
    const form = await startJoining(page);
    await form.getByRole("button", { name: "Your amount for Hotel" }).click();
    const input = form.getByRole("textbox", { name: "Your amount for Hotel" });
    await input.fill("");
    await input.pressSequentially("4000");
    await expect(text(page, "AIMAN 40.00")).toBeVisible();
    expect((await serverItem("hotel"))?.overrides).toEqual({});

    await input.press("Enter");
    await submit(form);
    const id = await me();
    await settled(async () => (await serverItem("hotel"))?.overrides[id], 4000);
    await expect(text(page, "AIMAN 40.00")).toBeVisible();
  });

  test("joins one bill with an automatic share, then undo", async ({ page }) => {
    const form = await startJoining(page);
    await expect(form.getByText("RM 75.00")).toBeVisible();
    await submit(form);
    await expect(text(page, "Your bills are updated")).toBeVisible();

    const id = await me();
    await settled(async () => (await serverItem("hotel"))?.participants.includes(id), true);
    expect((await serverItem("hotel"))?.overrides).toEqual({});
    expect((await serverItem("dinner"))?.participants.includes(id)).toBe(false);
    await expect(text(page, "75.00 EACH")).toBeVisible();

    await button(page, "Undo").click();
    await settled(async () => (await serverItem("hotel"))?.participants.includes(id), false);
    expect((await serverItem("hotel"))?.joins).toBeUndefined();
  });

  test("writes an amount and the others share the rest", async ({ page }) => {
    const form = await startJoining(page);
    await form.getByRole("button", { name: "Your amount for Hotel" }).click();
    const input = form.getByRole("textbox", { name: "Your amount for Hotel" });
    await input.fill("");
    await input.pressSequentially("3000");
    await input.press("Enter");
    await expect(form.getByRole("checkbox", { name: "Hotel" })).toHaveAttribute("aria-checked", "true");
    await submit(form);
    const id = await me();
    await settled(async () => (await serverItem("hotel"))?.overrides[id], 3000);
    await expect(text(page, "90.00 EACH")).toBeVisible();
  });

  test("an amount above the bill cannot be saved", async ({ page }) => {
    const form = await startJoining(page);
    await form.getByRole("button", { name: "Your amount for Dinner" }).click();
    const input = form.getByRole("textbox", { name: "Your amount for Dinner" });
    await input.fill("");
    await input.pressSequentially("10000");
    await expect(form.getByText("More than what's left on this bill")).toBeVisible();
    await expect(form.locator("button[type=submit]")).toBeDisabled();
  });

  test("tapping an amount without changing it stays automatic", async ({ page }) => {
    const form = await startJoining(page);
    await form.getByRole("button", { name: "Your amount for Hotel" }).click();
    await form.getByRole("textbox", { name: "Your amount for Hotel" }).press("Enter");
    await submit(form);
    const id = await me();
    await settled(async () => (await serverItem("hotel"))?.participants.includes(id), true);
    expect((await serverItem("hotel"))?.overrides).toEqual({});
  });

  test("joins all, then unticks all", async ({ page }) => {
    const form = await startJoining(page);
    await form.getByRole("button", { name: "Join all" }).click();
    await expect(form.getByText("RM 97.50")).toBeVisible();
    await form.getByRole("button", { name: "Untick all" }).click();
    await expect(form.getByText("RM 0.00")).toBeVisible();
    await expect(form.locator("button[type=submit]")).toBeDisabled();
    await form.getByRole("button", { name: "Join all" }).click();
    await submit(form);
    const id = await me();
    await settled(async () => (await serverDoc()).items.every((i) => i.participants.includes(id)), true);
  });

  test("changes the amount later and leaves on the same phone", async ({ page }) => {
    let form = await startJoining(page);
    await submit(form);
    const id = await me();
    await settled(async () => (await serverItem("hotel"))?.participants.includes(id), true);

    await button(page, "Change Hotel").click();
    form = panel(page);
    await expect(form.getByText("Tap the amount to write your own, or untick to leave Hotel.")).toBeVisible();
    await expect(form.getByRole("button", { name: "Join all" })).toHaveCount(0);
    await expect(form.locator("button[type=submit]")).toBeDisabled();
    await expect(text(page, "75.00 EACH")).toBeVisible();
    await form.getByRole("button", { name: "Your amount for Hotel" }).click();
    const input = form.getByRole("textbox", { name: "Your amount for Hotel" });
    await input.fill("");
    await input.pressSequentially("4000");
    await input.press("Enter");
    await submit(form);
    await settled(async () => (await serverItem("hotel"))?.overrides[id], 4000);
    expect(await eventKinds()).toContain("share_changed");

    await button(page, "Change Hotel").click();
    form = panel(page);
    await form.getByRole("checkbox", { name: "Hotel" }).click();
    await submit(form);
    await settled(async () => (await serverItem("hotel"))?.participants.includes(id), false);
    expect(await eventKinds()).toContain("bill_left");
    await expect(button(page, "Join Hotel")).toBeVisible();
  });

  test("a bill you were already in is fixed and cannot be left", async ({ page }) => {
    await seed({ ...trip, items: [hotel, { ...dinner, participants: ["h", "a"] }] });
    await openAs(page, "Najmi");
    const form = await openJoin(page, "Dinner");
    const hotelBox = form.getByRole("checkbox", { name: "Hotel" });
    await expect(hotelBox).toBeDisabled();
    await expect(form.getByText("You're in this bill").first()).toBeVisible();
  });

  test("a bill with every amount set cannot be joined", async ({ page }) => {
    await seed({
      ...trip,
      items: [{ ...hotel, participants: ["h", "n"], overrides: { h: 10000, n: 20000 } }, dinner],
    });
    const form = await startJoining(page, "Dinner");
    await expect(button(page, "Join Hotel")).toHaveCount(0);
    await expect(form.getByRole("checkbox", { name: "Hotel" })).toBeDisabled();
    await expect(form.getByText("Every amount is set. Ask Haziq.")).toBeVisible();
  });

  test("someone who already paid too much gets paid back", async ({ page }) => {
    await seed(trip, { payments: [paymentRow("n", "h", 10000)] });
    await openBill(page);
    await submit(await joinAs(page, "Aiman"));
    await expect(page.getByRole("button", { name: /PAYS NAJMI/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /PAYS NAJMI.*25\.00/ })).toBeVisible();
  });

  test("the form still fits and every input stays 16px so iPhone does not zoom", async ({ page }) => {
    const form = await startJoining(page);
    await form.getByRole("button", { name: "Your amount for Hotel" }).click();
    const size = await form
      .getByRole("textbox", { name: "Your amount for Hotel" })
      .evaluate((el) => getComputedStyle(el).fontSize);
    expect(size).toBe("16px");
    const box = await form.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
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
    await expect(button(page, /^History · 1/)).toBeVisible();
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
  test("offers WhatsApp after a change, and can be dismissed", async ({ page }) => {
    await page.addInitScript(() => {
      window.open = ((url: string) => {
        (window as unknown as { opened: string }).opened = url;
        return null;
      }) as typeof window.open;
    });
    await openBill(page);
    await submit(await startAdding(page, "Snacks", "1000", "Najmi"));
    await expect(text(page, "The amounts changed. Tell the group?")).toBeVisible();
    await button(page, "WhatsApp").click();
    const opened = await page.evaluate(() => (window as unknown as { opened: string }).opened);
    expect(opened).toContain("wa.me");
    expect(decodeURIComponent(opened)).toContain("Najmi updated Trip");
    expect(decodeURIComponent(opened).endsWith(`/bill/${BILL}`)).toBe(true);
    await expect(page.getByText("The amounts changed. Tell the group?")).toHaveCount(0);
  });

  test("shows changes since the last visit, without counting your own", async ({ browser }) => {
    const me = await newPhone(browser);
    const other = await newPhone(browser);
    await openBill(me);
    await submit(await startAdding(me, "Mine", "1000", "Najmi"));
    await settled(itemNames, ["Hotel", "Mine"]);

    await openBill(me);
    await expect(button(me, "Add bill")).toBeVisible();
    await expect(me.getByText(/since your last visit/)).toHaveCount(0);

    await openBill(other);
    await submit(await startAdding(other, "Theirs", "2000", "Afiq"));
    await settled(itemNames, ["Hotel", "Mine", "Theirs"]);

    await openBill(me);
    await expect(text(me, "1 change since your last visit")).toBeVisible();
    await me.getByText("1 change since your last visit").click();
    await expect(sheet(me).getByText(/Afiq added Theirs/)).toBeVisible();

    await openBill(me);
    await expect(button(me, "Add bill")).toBeVisible();
    await expect(me.getByText(/since your last visit/)).toHaveCount(0);
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
