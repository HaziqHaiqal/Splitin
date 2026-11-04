import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  BILL,
  button,
  clearPayments,
  closePhones,
  dinner,
  eventKinds,
  getDb,
  hotel,
  joinAs,
  joinButton,
  lockSwitch,
  menuCard,
  newPhone,
  notMe,
  OLD,
  openAs,
  openBill,
  openBillDetail,
  openBills,
  openFresh,
  openHistory,
  openMenu,
  openMine,
  openPeople,
  ownerStorage,
  panel,
  patchDoc,
  payLine,
  paymentRow,
  paymentsOf,
  pickMe,
  seed,
  serverDoc,
  serverItem,
  settled,
  sheet,
  startAdding,
  submit,
  text,
  TOKEN,
  trip,
  wipe,
} from "./helpers";

test.beforeEach(() => seed());
test.afterEach(() => closePhones());

const openDraft = (doc = trip) => ({ "splitin:draft:v2": { doc, billId: null, seenAt: "" } });

test.describe("starting a bill", () => {
  const savedDraft = (page: import("@playwright/test").Page) =>
    page.evaluate(() => JSON.parse(localStorage.getItem("splitin:draft:v2") ?? "null"));
  const billName = (page: import("@playwright/test").Page) => page.getByLabel("What are you splitting?");
  const names = (page: import("@playwright/test").Page) => page.getByLabel("Who's splitting?");
  const peopleIn = async (page: import("@playwright/test").Page) =>
    (await savedDraft(page)).doc.people.map((p: { name: string }) => p.name);

  test("asks the bill name, then the names, printing both on the receipt as you type", async ({ page }) => {
    await page.goto("/");
    await expect(billName(page)).toHaveValue("");
    await expect(text(page, "BILL NAME")).toBeVisible();
    await expect(text(page, "WHO'S SPLITTING?")).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(billName(page)).toBeFocused();

    await billName(page).fill("House bills");
    await expect(text(page, "HOUSE BILLS")).toBeVisible();
    await billName(page).press("Enter");
    await expect(names(page)).toBeFocused();
    await names(page).pressSequentially("Najmi, Af");
    await expect(button(page, "Remove Najmi")).toBeVisible();
    await expect(text(page, "NAJMI · AF")).toBeVisible();
    await names(page).pressSequentially("iq");
    await names(page).press("Enter");
    await expect(button(page, "Remove Afiq")).toBeVisible();
    await expect(names(page)).toHaveValue("");
    expect(await savedDraft(page)).toBeNull();

    await names(page).press("Enter");
    await expect(page.getByRole("button", { name: "Edit title" })).toHaveText("House bills");
    expect((await savedDraft(page)).doc.title).toBe("House bills");
    expect(await peopleIn(page)).toEqual(["Najmi", "Afiq"]);
  });

  test("going back keeps the names, Backspace takes the last one off, and repeats are refused", async ({ page }) => {
    await page.goto("/");
    await billName(page).fill("Trip");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await names(page).fill("Najmi, Afiq, najmi,");
    await expect(text(page, "najmi is already in the list")).toBeVisible();
    await names(page).press("Backspace");
    await expect(button(page, "Remove Afiq")).toHaveCount(0);

    await button(page, "Edit title").click();
    await expect(billName(page)).toHaveValue("Trip");
    await billName(page).fill("Langkawi");
    await billName(page).press("Enter");
    await expect(button(page, "Remove Najmi")).toBeVisible();
    await names(page).fill("Imanul");
    await button(page, "Start").click();
    await expect(page.getByRole("button", { name: "Edit title" })).toHaveText("Langkawi");
    expect(await peopleIn(page)).toEqual(["Najmi", "Imanul"]);
  });

  test("the name cannot be emptied later", async ({ browser }) => {
    const phone = await newPhone(browser, openDraft());
    await phone.goto("/");
    await phone.getByRole("button", { name: "Edit title" }).click();
    const input = phone.getByRole("textbox", { name: "Edit title" });
    await input.fill("   ");
    await input.press("Enter");
    await expect(phone.getByRole("button", { name: "Edit title" })).toHaveText("Trip");
  });

  test("Clear all goes back to an empty name", async ({ browser }) => {
    const phone = await newPhone(browser, openDraft());
    await phone.goto("/");
    await button(phone, "Clear all").click();
    await expect(billName(phone)).toHaveValue("");
  });

  test("removing everyone keeps the name you typed", async ({ browser }) => {
    const phone = await newPhone(browser, openDraft({ ...trip, people: [], items: [] }));
    await phone.goto("/");
    await expect(billName(phone)).toHaveValue("Trip");
  });
});

test.describe("sharing", () => {
  test("asks which one is you, then uses that name", async ({ browser }) => {
    const { ownerId, ...doc } = trip;
    void ownerId;
    const owner = await newPhone(browser, openDraft(doc));
    await owner.goto("/");
    await button(owner, "Share receipt").click();
    const list = sheet(owner);
    await expect(list.getByRole("heading", { name: "Which one is you?" })).toBeVisible();
    await list.getByRole("button", { name: "Najmi" }).click();
    await expect(sheet(owner).getByText("Copy link")).toBeVisible();

    const db = await getDb();
    const published = db.bills.find((b) => b.id !== BILL)!;
    expect(published.doc.ownerId).toBe("n");

    const member = await newPhone(browser);
    await member.goto(`/bill/${published.id}`);
    await expect(text(member, "SHARED BY NAJMI")).toBeAttached();
    const who = sheet(member);
    await expect(who.getByRole("button", { name: "Haziq" })).toBeVisible();
    await expect(who.getByRole("button", { name: "Najmi" })).toHaveCount(0);
  });

  test("an owner not on the list types their name and is in no bills", async ({ browser }) => {
    const { ownerId, ...doc } = trip;
    void ownerId;
    const owner = await newPhone(browser, openDraft(doc));
    await owner.goto("/");
    await button(owner, "Share receipt").click();
    const ask = sheet(owner);
    await ask.getByRole("button", { name: "Not on the list" }).click();
    await ask.getByPlaceholder("Name").fill("Zara");
    await ask.getByRole("button", { name: "Share", exact: true }).click();
    await expect(sheet(owner).getByText("Copy link")).toBeVisible();
    const published = (await getDb()).bills.find((b) => b.id !== BILL)!;
    const zara = published.doc.people.find((p) => p.name === "Zara")!;
    expect(published.doc.ownerId).toBe(zara.id);
    expect(published.doc.items.some((i) => i.participants.includes(zara.id))).toBe(false);
  });
});

test("a bill shared before owners were saved is not asked again", async ({ browser }) => {
  const { ownerId, ...doc } = trip;
  void ownerId;
  await seed(doc);
  const owner = await newPhone(browser, ownerStorage(doc));
  await owner.goto("/");
  await button(owner, "Share receipt").click();
  await expect(sheet(owner).getByText("Copy link")).toBeVisible();
  await expect(owner.getByRole("heading", { name: "Which one is you?" })).toHaveCount(0);
});

test.describe("saving over members' changes", () => {
  test("an old copy on the owner's phone loses nothing a member did", async ({ browser }) => {
    await seed({ ...trip, items: [hotel, dinner] });
    const owner = await newPhone(browser, ownerStorage({ ...trip, items: [hotel, dinner] }, OLD));
    await owner.goto("/");
    await expect(text(owner, "HOTEL")).toBeVisible();

    const member = await newPhone(browser);
    await openBill(member);
    await joinAs(member, "Aiman");
    await settled(async () => (await serverItem("hotel"))?.participants.length, 4);
    await openBill(member);
    await submit(await startAdding(member, "Snacks", "1000"));
    await settled(async () => (await serverDoc()).items.length, 3);

    const eventsBefore = await eventKinds();
    await owner.evaluate(() => {
      const raw = localStorage.getItem("splitin:draft:v2")!;
      const draft = JSON.parse(raw);
      draft.doc.title = "Renamed";
      localStorage.setItem("splitin:draft:v2", JSON.stringify(draft));
      window.dispatchEvent(new Event("storage"));
    });
    await settled(async () => (await serverDoc()).title, "Renamed");

    const doc = await serverDoc();
    expect(doc.people.map((p) => p.name)).toContain("Aiman");
    expect(doc.items.map((i) => i.name)).toEqual(["Hotel", "Dinner", "Snacks"]);
    const aiman = doc.people.find((p) => p.name === "Aiman")!;
    expect(doc.items[0].participants).toContain(aiman.id);

    const added = (await eventKinds()).filter((k) => !eventsBefore.includes(k) || k === "title_changed");
    expect(added).toEqual(["title_changed"]);
    const ownerEvents = (await getDb()).bill_events.filter((e) => e.by_role === "owner").map((e) => e.kind);
    expect(ownerEvents).toEqual(["title_changed"]);

    await expect
      .poll(() =>
        owner.evaluate(() => JSON.parse(localStorage.getItem("splitin:draft:v2")!).doc.people.length as number),
      )
      .toBe(4);
  });

  test("the owner's delete stays deleted, and a member's later bill still arrives", async ({ browser }) => {
    const items = [hotel, dinner];
    await seed({ ...trip, items });
    const owner = await newPhone(browser, ownerStorage({ ...trip, items }, OLD));
    await owner.goto("/");
    await expect(text(owner, "DINNER")).toBeVisible();
    await owner.waitForTimeout(1500);

    await owner.evaluate(() => {
      const draft = JSON.parse(localStorage.getItem("splitin:draft:v2")!);
      draft.doc.items = draft.doc.items.filter((i: { id: string }) => i.id !== "dinner");
      localStorage.setItem("splitin:draft:v2", JSON.stringify(draft));
      window.dispatchEvent(new Event("storage"));
    });
    await settled(async () => (await serverDoc()).items.map((i) => i.name), ["Hotel"]);

    const member = await newPhone(browser);
    await openBill(member);
    await submit(await startAdding(member, "Toll", "500", "Najmi"));
    await settled(async () => (await serverDoc()).items.map((i) => i.name), ["Hotel", "Toll"]);

    await owner.goto("/");
    await expect(text(owner, "TOLL")).toBeVisible();
    await expect(owner.getByText("DINNER")).toHaveCount(0);
  });
});

test.describe("owner screen", () => {
  const tracking = async (browser: Browser, doc = trip) => {
    const owner = await newPhone(browser, ownerStorage(doc));
    await openBill(owner);
    await expect(owner.getByText("Owner", { exact: true })).toBeVisible();
    return owner;
  };
  const paidLine = (page: Page, from: string) =>
    page.getByRole("button", { name: new RegExp(`${from} PAYS HAZIQ .* PAID`) });

  test("greets the owner: owner tools under Hi Haziq, the rest in the menu", async ({ browser }) => {
    const owner = await tracking(browser);
    await expect(owner.getByRole("heading", { name: "Who are you?" })).toHaveCount(0);
    await openMenu(owner);
    const card = menuCard(owner);
    for (const label of ["Add bill", "History", "Calculation"])
      await expect(card.getByRole("button", { name: label, exact: true })).toBeVisible();
    for (const label of ["Bank", "Rename", "Lock", "Owner link", "Edit name"])
      await expect(card.getByRole("button", { name: label, exact: true })).toHaveCount(0);
    await expect(card.getByRole("button", { name: /^Your bills/ })).toBeVisible();
    await owner.keyboard.press("Escape");

    const tools = await openMine(owner);
    for (const label of [/^Bank details/, /^Bill name and people/, /^Copy owner link/, /^Make a new owner link/])
      await expect(tools.getByRole("button", { name: label })).toBeVisible();
    await expect(lockSwitch(owner)).toHaveAttribute("aria-checked", "true");
    await expect(tools.getByRole("button", { name: "Edit name" })).toHaveCount(0);
  });

  test("an owner of a bill with no owner name is asked once", async ({ browser }) => {
    const doc = { ...trip, ownerId: null };
    await seed(doc);
    const owner = await newPhone(browser, ownerStorage(doc));
    await openFresh(owner);
    const ask = sheet(owner);
    await expect(ask.getByRole("heading", { name: "Which one is you?" })).toBeVisible();
    await ask.getByRole("button", { name: "Haziq" }).click();
    await settled(async () => (await serverDoc()).ownerId, "h");
    await expect(button(owner, "Hi Haziq")).toBeVisible();
    await openFresh(owner);
    await expect(button(owner, "Hi Haziq")).toBeVisible();
    await expect(owner.getByRole("heading", { name: "Which one is you?" })).toHaveCount(0);
  });

  test("an owner with no owner name can type it", async ({ browser }) => {
    const doc = { ...trip, ownerId: null };
    await seed(doc);
    const owner = await newPhone(browser, ownerStorage(doc));
    await openFresh(owner);
    const ask = sheet(owner);
    await ask.getByRole("button", { name: "Not on the list" }).click();
    await ask.getByPlaceholder("Name").fill("Zara");
    await ask.getByRole("button", { name: "Save", exact: true }).click();
    await expect(button(owner, "Hi Zara")).toBeVisible();
    const saved = await serverDoc();
    const zara = saved.people.find((p) => p.name === "Zara")!;
    expect(saved.ownerId).toBe(zara.id);
    expect(saved.items.some((i) => i.participants.includes(zara.id))).toBe(false);
  });

  test("a bill whose owner is not on the list has no greeting", async ({ browser }) => {
    const doc = { ...trip, ownerId: null };
    await seed(doc);
    const owner = await tracking(browser, doc);
    await expect(owner.getByText(/^Hi /)).toHaveCount(0);
  });

  test("marks paid and unpaid from any line, naming the owner in History", async ({ browser }) => {
    const owner = await tracking(browser);
    await expect(text(owner, "Tap any payment to mark it paid or send a reminder.")).toBeVisible();
    await payLine(owner, "NAJMI", "HAZIQ").click();
    const ask = sheet(owner);
    await expect(ask.getByRole("heading", { name: "Najmi paid Haziq?" })).toBeVisible();
    await expect(ask.getByRole("button", { name: "Remind Najmi" })).toBeVisible();
    await ask.getByRole("button", { name: "Mark paid" }).click();
    await settled(async () => (await paymentsOf()).length, 1);

    await paidLine(owner, "NAJMI").click();
    await expect(sheet(owner).getByText(/You marked paid/)).toBeVisible();
    await sheet(owner).getByRole("button", { name: "Mark unpaid" }).click();
    await settled(paymentsOf, []);
    await settled(async () => (await eventKinds()).sort(), ["paid", "unpaid"]);
    const list = await openHistory(owner);
    await expect(list.getByText(/Haziq marked/)).toBeVisible();
    await expect(list.getByText(/Haziq undid the payment/)).toBeVisible();
  });

  test("Remind sends a reminder through the phone's share menu", async ({ browser }) => {
    const owner = await newPhone(browser, ownerStorage());
    await owner.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          (window as unknown as { shared: ShareData }).shared = data;
        },
      });
    });
    await openBill(owner);
    await payLine(owner, "NAJMI", "HAZIQ").click();
    await sheet(owner).getByRole("button", { name: "Remind Najmi" }).click();
    await expect(sheet(owner)).toHaveCount(0);
    const shared = await owner.evaluate(() => (window as unknown as { shared: ShareData }).shared.text!);
    expect(shared).toContain("Hi Najmi, a gentle reminder for Trip: please pay Haziq RM 100.00.");
    expect(shared.endsWith(`/bill/${BILL}`)).toBe(true);
  });

  test("a payment already removed elsewhere shows no error and is not logged twice", async ({ browser }) => {
    const owner = await tracking(browser);
    await payLine(owner, "NAJMI", "HAZIQ").click();
    await sheet(owner).getByRole("button", { name: "Mark paid" }).click();
    await paidLine(owner, "NAJMI").click();
    await clearPayments();
    await sheet(owner).getByRole("button", { name: "Mark unpaid" }).click();
    await expect(text(owner, "is unpaid again")).toBeVisible();
    await expect(owner.getByText("Something went wrong")).toHaveCount(0);
    expect(await eventKinds()).toEqual(["paid"]);
  });

  test("records a different amount", async ({ browser }) => {
    const owner = await tracking(browser);
    await payLine(owner, "NAJMI", "HAZIQ").click();
    await sheet(owner).getByRole("button", { name: "Change ›" }).click();
    const form = panel(owner);
    await form.locator("input[inputmode='numeric']").pressSequentially("2500");
    await submit(form);
    await settled(paymentsOf, [{ from: "n", to: "h", amountMinor: 2500 }]);
  });

  test("names the member who paid", async ({ browser, page }) => {
    await openAs(page, "Afiq");
    await page.getByRole("button", { name: /AFIQ PAYS HAZIQ/ }).click();
    await sheet(page).getByRole("button", { name: "Mark paid" }).click();
    await settled(async () => (await paymentsOf()).length, 1);

    const owner = await tracking(browser);
    await paidLine(owner, "AFIQ").click();
    await expect(sheet(owner).getByText(/Afiq tapped paid/)).toBeVisible();
  });

  test("locks and unlocks the bill", async ({ browser, page }) => {
    const owner = await tracking(browser);
    await openMine(owner);
    await lockSwitch(owner).click();
    await expect(text(owner, "Locked. Everyone else can only mark payments now.")).toBeVisible();
    await expect(lockSwitch(owner)).toHaveAttribute("aria-checked", "false");
    await settled(async () => (await serverDoc()).locked, true);
    await openBill(page);
    await expect(text(page, "Haziq locked this bill")).toBeVisible();

    await lockSwitch(owner).click();
    await settled(async () => (await serverDoc()).locked, undefined);
    await openBill(page);
    await expect(button(page, "Who are you?")).toBeVisible();
    await expect(page.getByText("Haziq locked this bill")).toHaveCount(0);
    expect(await eventKinds()).toEqual(expect.arrayContaining(["locked", "unlocked"]));
  });

  test("Bill name and people changes the bill name and the names, with Undo", async ({ browser }) => {
    const owner = await tracking(browser);
    const form = await openPeople(owner);
    await form.locator("input[maxlength='60']").fill("Langkawi");
    await form.getByLabel("Name: Najmi").fill("Najmi R");
    await submit(form);
    await expect(text(owner, "Names saved")).toBeVisible();
    const names = async () => {
      const doc = await serverDoc();
      return [doc.title, ...doc.people.map((p) => p.name)];
    };
    await settled(names, ["Langkawi", "Haziq", "Najmi R", "Afiq"]);
    await expect(text(owner, "NAJMI R")).toBeVisible();

    await button(owner, "Undo").click();
    await settled(names, ["Trip", "Haziq", "Najmi", "Afiq"]);
  });

  test("Bill name and people adds and removes people, with Undo", async ({ browser }) => {
    const owner = await tracking(browser);
    const form = await openPeople(owner);
    await expect(form.getByRole("button", { name: "Remove Haziq" })).toHaveCount(0);
    await form.getByRole("button", { name: "Remove Najmi" }).click();
    await expect(form.getByText("People · 2")).toBeVisible();
    await form.getByRole("button", { name: "Undo" }).click();
    await expect(form.getByText("People · 3")).toBeVisible();
    await form.getByRole("button", { name: "Remove Najmi" }).click();
    await form.getByRole("button", { name: "Add person" }).click();
    await form.getByPlaceholder("Name").fill("Zara");
    await submit(form);
    await expect(text(owner, "Names saved")).toBeVisible();
    const names = async () => (await serverDoc()).people.map((p) => p.name);
    await settled(names, ["Haziq", "Afiq", "Zara"]);
    expect((await serverItem("hotel"))?.participants).toEqual(["h", "a"]);

    await button(owner, "Undo").click();
    await settled(names, ["Haziq", "Najmi", "Afiq"]);
    expect((await serverItem("hotel"))?.participants).toEqual(["h", "n", "a"]);
  });

  test("Bill name and people won't remove someone who paid a bill or has a payment", async ({ browser }) => {
    const doc = { ...trip, items: [hotel, dinner] };
    await seed(doc, { payments: [paymentRow("n", "h", 10000)] });
    const owner = await tracking(browser, doc);
    const form = await openPeople(owner);
    await form.getByRole("button", { name: "Remove Afiq" }).click();
    await expect(text(owner, "Afiq paid a bill. Change who paid first.")).toBeVisible();
    await form.getByRole("button", { name: "Remove Najmi" }).click();
    await expect(text(owner, "Najmi has a payment marked. Mark it unpaid first.")).toBeVisible();
    await expect(form.getByRole("button", { name: "Undo" })).toHaveCount(0);
  });

  test("Bill name and people refuses an empty or repeated name", async ({ browser }) => {
    const owner = await tracking(browser);
    const form = await openPeople(owner);
    await form.getByLabel("Name: Afiq").fill("najmi");
    await submit(form);
    await expect(text(owner, "najmi is already in the list")).toBeVisible();
    await form.getByLabel("Name: Afiq").fill(" ");
    await submit(form);
    await expect(text(owner, "Names can't be empty.")).toBeVisible();
    expect((await serverDoc()).people.map((p) => p.name)).toEqual(["Haziq", "Najmi", "Afiq"]);
  });

  test("a dot on the menu shows members' changes only, until History is opened", async ({ browser, page }) => {
    const owner = await tracking(browser);
    const dot = owner.locator("[data-menu-button] > i");
    await openMine(owner);
    await lockSwitch(owner).click();
    await settled(async () => (await serverDoc()).locked, true);
    await lockSwitch(owner).click();
    await settled(async () => (await serverDoc()).locked, undefined);
    await openBill(owner);
    await expect(owner.getByText("Owner", { exact: true })).toBeVisible();
    await expect(dot).toHaveCount(0);

    await openBill(page);
    await submit(await startAdding(page, "Snacks", "1000", "Najmi"));
    await settled(async () => (await serverDoc()).items.length, 2);
    await openBill(owner);
    await expect(dot).toBeVisible();
    await openHistory(owner);
    await owner.keyboard.press("Escape");
    await expect(dot).toHaveCount(0);
    await openBill(owner);
    await expect(owner.getByText("Owner", { exact: true })).toBeVisible();
    await expect(dot).toHaveCount(0);
  });

  test("the paid-off page keeps History, and can go back to the full page", async ({ browser }) => {
    await seed(trip, { payments: [paymentRow("n", "h", 10000), paymentRow("a", "h", 10000)] });
    const owner = await newPhone(browser, ownerStorage());
    await openBill(owner);
    await expect(text(owner, "Everyone")).toBeVisible();
    await expect(text(owner, "Hi Haziq")).toBeVisible();
    await expect(button(owner, /^History/)).toBeVisible();
    await button(owner, "Not paid after all? Change it").click();
    await expect(text(owner, "Everyone's paid")).toBeVisible();
    await openMine(owner);
    await expect(lockSwitch(owner)).toBeVisible();
    await expect(sheet(owner).getByRole("button", { name: /^Copy owner link/ })).toBeVisible();
  });
});

test.describe("owner link and editing", () => {
  test("a new phone becomes the owner through the private link", async ({ browser }) => {
    const phone = await newPhone(browser);
    await phone.goto(`/bill/${BILL}#owner=${TOKEN}`);
    await expect(text(phone, "You can edit this bill on this device now")).toBeVisible();
    await expect(phone.getByText("Owner", { exact: true })).toBeVisible();
    expect(await phone.evaluate((id) => localStorage.getItem(`splitin:asked:${id}`), BILL)).toBeNull();
    expect(phone.url()).not.toContain("owner=");
  });

  test("a wrong token gives nothing", async ({ browser }) => {
    const phone = await newPhone(browser);
    await phone.goto(`/bill/${BILL}#owner=wrongwrongwrongwrongwrong`);
    await expect(text(phone, "This owner link no longer works")).toBeVisible();
    await expect(button(phone, "Who are you?")).toBeVisible();
    await expect(phone.getByRole("heading", { name: "Who are you?" })).toHaveCount(0);
    expect(await phone.evaluate((id) => localStorage.getItem(`splitin:owner:${id}`), BILL)).toBeNull();
  });

  test("Owner link copies the private link", async ({ browser }) => {
    const owner = await newPhone(browser, ownerStorage());
    await owner.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await openBill(owner);
    await (await openMine(owner)).getByRole("button", { name: /^Copy owner link/ }).click();
    await expect(text(owner, "Owner link copied")).toBeVisible();
    expect(await owner.evaluate(() => navigator.clipboard.readText())).toContain(`#owner=${TOKEN}`);
  });

  test("a new owner link stops the old one", async ({ browser }) => {
    const owner = await newPhone(browser, ownerStorage());
    await openBill(owner);
    await (await openMine(owner)).getByRole("button", { name: /^Make a new owner link/ }).click();
    await expect(text(owner, "New owner link made")).toBeVisible();
    const stored = () => owner.evaluate((id) => localStorage.getItem(`splitin:owner:${id}`), BILL);
    await expect.poll(stored).not.toBe(TOKEN);
    const fresh = await stored();

    const old = await newPhone(browser, { [`splitin:owner:${BILL}`]: TOKEN });
    await openBill(old);
    await expect(text(old, "This owner link no longer works")).toBeVisible();
    await expect(old.getByText("Owner", { exact: true })).toHaveCount(0);
    expect(await old.evaluate((id) => localStorage.getItem(`splitin:owner:${id}`), BILL)).toBeNull();

    const next = await newPhone(browser);
    await next.goto(`/bill/${BILL}#owner=${fresh}`);
    await expect(text(next, "You can edit this bill on this device now")).toBeVisible();
    await expect(next.getByText("Owner", { exact: true })).toBeVisible();
  });
});

test.describe("people on the owner's phone", () => {
  const openPerson = async (owner: import("@playwright/test").Page, name: string) => {
    await owner.goto("/");
    await owner.getByRole("button", { name, exact: false }).first().click();
    const details = sheet(owner);
    await expect(details.getByRole("button", { name: `Remove ${name}` })).toBeVisible();
    return details;
  };

  test("cannot remove someone with a payment marked", async ({ browser }) => {
    await seed(trip, { payments: [paymentRow("n", "h", 10000)] });
    const owner = await newPhone(browser, ownerStorage());
    const details = await openPerson(owner, "Najmi");
    await details.getByRole("button", { name: "Remove Najmi" }).click();
    await expect(text(owner, "Najmi has a payment marked. Mark it unpaid first.")).toBeVisible();
    expect((await serverDoc()).people).toHaveLength(3);
  });

  test("can remove someone with no payment", async ({ browser }) => {
    const owner = await newPhone(browser, ownerStorage());
    const details = await openPerson(owner, "Najmi");
    await details.getByRole("button", { name: "Remove Najmi" }).click();
    await settled(async () => (await serverDoc()).people.map((p) => p.name), ["Haziq", "Afiq"]);
  });

  test("+ Add in the bill form adds a name for the owner too", async ({ browser }) => {
    const owner = await newPhone(browser, ownerStorage());
    await owner.goto("/");
    await button(owner, "Add bill").click();
    const form = panel(owner);
    await form.locator("input[maxlength='60']").fill("Water");
    await form.locator("input[inputmode='numeric']").pressSequentially("3000");
    await form.getByRole("button", { name: "+ Add" }).click();
    await form.getByPlaceholder("Name").fill("Siti");
    await form.getByRole("button", { name: "Add", exact: true }).click();
    await submit(form);
    await settled(async () => (await serverDoc()).people.map((p) => p.name), ["Haziq", "Najmi", "Afiq", "Siti"]);
    expect((await serverDoc()).items[1].participants).toHaveLength(4);
  });
});

test.describe("one name per person", () => {
  test("the server refuses a name someone else just took, and the owner can fix it", async ({ browser }) => {
    const owner = await newPhone(browser, ownerStorage());
    const pulled = owner.waitForResponse((r) => r.request().method() === "POST");
    await owner.goto("/");
    await pulled;
    await patchDoc((doc) => ({
      ...doc,
      people: [...doc.people, { id: "s", name: "Ali", color: 3, addedAt: new Date().toISOString() }],
    }));
    await button(owner, "+ Add").click();
    await owner.getByLabel("Add person").fill("ali");
    await owner.getByLabel("Add person").press("Enter");
    await expect(owner.getByText("Ali is already in the list", { exact: true })).toBeVisible();
    const names = async () => (await serverDoc()).people.map((p) => p.name);
    expect(await names()).toEqual(["Haziq", "Najmi", "Afiq", "Ali"]);

    await owner.evaluate(() => {
      const draft = JSON.parse(localStorage.getItem("splitin:draft:v2")!);
      draft.doc.people = draft.doc.people.filter((p: { name: string }) => p.name !== "ali");
      draft.doc.title = "Renamed";
      localStorage.setItem("splitin:draft:v2", JSON.stringify(draft));
      window.dispatchEvent(new Event("storage"));
    });
    await settled(async () => (await serverDoc()).title, "Renamed");
    expect(await names()).toEqual(["Haziq", "Najmi", "Afiq", "Ali"]);
  });

  test("a new bill with a repeated name is not created", async ({ browser }) => {
    const repeated = { ...trip, people: [...trip.people, { id: "x", name: "NAJMI", color: 3 }] };
    const owner = await newPhone(browser, openDraft(repeated));
    await owner.goto("/");
    await button(owner, "Share receipt").click();
    await expect(text(owner, "NAJMI is already in the list")).toBeVisible();
    expect((await getDb()).bills).toHaveLength(1);
  });
});

test.describe("History", () => {
  test("keeps who did what, by role, ID and name", async ({ browser, page }) => {
    await openBill(page);
    await submit(await startAdding(page, "Snacks", "1000", "Najmi"));
    await settled(async () => (await serverDoc()).items.length, 2);
    const owner = await newPhone(browser, ownerStorage());
    await openBill(owner);
    await expect(owner.getByText("Owner", { exact: true })).toBeVisible();
    await openMine(owner);
    await lockSwitch(owner).click();
    await settled(async () => (await serverDoc()).locked, true);
    await expect.poll(async () => (await getDb()).bill_events.length).toBe(2);

    const rows = (await getDb()).bill_events;
    const pick = (kind: string) => rows.find((e) => e.kind === kind)!;
    expect(pick("item_added")).toMatchObject({ by_role: "member", by_person_id: "n", by_name: "Najmi" });
    expect(pick("locked")).toMatchObject({ by_role: "owner", by_person_id: "h", by_name: "Haziq" });
    expect(pick("item_added").data).not.toHaveProperty("by");
  });

  test("starts with the bills the owner shared", async ({ browser, page }) => {
    await wipe();
    const owner = await newPhone(browser, openDraft({ ...trip, items: [hotel, dinner] }));
    await owner.goto("/");
    await button(owner, "Share receipt").click();
    await expect(sheet(owner).getByText("Copy link")).toBeVisible();
    const { bills, bill_events } = await getDb();
    expect(bill_events.map((e) => e.data)).toEqual([
      {
        items: [
          { name: "Hotel", amountMinor: 30000, payer: "Haziq" },
          { name: "Dinner", amountMinor: 9000, payer: "Afiq" },
        ],
      },
    ]);

    await page.goto(`/bill/${bills[0].id}`);
    await pickMe(page, "Just looking");
    const list = await openHistory(page);
    const row = (words: string) => list.getByRole("listitem").filter({ hasText: words });
    await expect(row("added Hotel")).toContainText("Paid by Haziq");
    await expect(row("added Hotel")).toContainText("RM 300.00");
    await expect(row("added Dinner")).toContainText("Paid by Afiq");
    await expect(list.getByText(/^Haziq shared this bill/)).toBeVisible();
  });

  test("reads like a group chat", async ({ page }) => {
    const event = (kind: string, minutesAgo: number, data: Record<string, unknown>, by_name?: string) => ({
      id: crypto.randomUUID(),
      bill_id: BILL,
      kind,
      by_role: "member",
      by_name,
      created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
      data,
    });
    await seed(trip, {
      bill_events: [
        event("paid", 1, { from: "Najmi", to: "Haziq", amountMinor: 10000 }, "Najmi"),
        event("item_added", 2, { name: "Snacks", amountMinor: 1000, payer: "Najmi" }, "Najmi"),
        event("person_joined", 3, { name: "Aiman" }),
        event("unpaid", 4, { from: "Afiq", to: "Haziq", amountMinor: 10000 }, "Afiq"),
      ],
    });
    await openBill(page);
    const list = await openHistory(page);

    const runs = list.getByRole("list");
    await expect(runs).toHaveCount(2);
    await expect(runs.first().getByRole("listitem")).toHaveCount(2);
    await expect(runs.first().getByRole("listitem").first()).toContainText("Najmi paid Haziq");
    await expect(runs.nth(1)).toContainText("Afiq undid their payment to Haziq");
    await expect(list.getByText("Aiman joined the bill")).toBeVisible();
    await expect(list.getByRole("listitem").filter({ hasText: "Aiman" })).toHaveCount(0);
  });

  test("groups changes by day, and doesn't say a name twice", async ({ page }) => {
    const noon = (daysAgo: number) => {
      const day = new Date();
      day.setDate(day.getDate() - daysAgo);
      day.setHours(12, 0, 0, 0);
      return day.toISOString();
    };
    const event = (
      kind: string,
      by_role: string,
      data: Record<string, unknown>,
      created_at: string,
      by_name?: string,
    ) => ({
      id: crypto.randomUUID(),
      bill_id: BILL,
      kind,
      by_role,
      by_name,
      data,
      created_at,
    });
    await seed(trip, {
      bill_events: [
        event("paid", "member", { from: "Najmi", to: "Haziq", amountMinor: 13000 }, noon(0), "Najmi"),
        event("paid", "owner", { from: "Afiq", to: "Haziq", amountMinor: 4000 }, noon(0)),
        event("paid", "member", { from: "Afiq", to: "Haziq", amountMinor: 500 }, noon(0)),
        event("unpaid", "member", { from: "Afiq", to: "Haziq", amountMinor: 4000 }, noon(1), "Afiq"),
        event("person_details", "owner", { name: "Haziq" }, noon(1)),
        event("item_edited", "owner", { name: "Hotel", changes: { amount: [28000, 30000], split: true } }, noon(5)),
      ],
    });
    await openBill(page);
    const list = await openHistory(page);
    const row = (words: string) => list.getByRole("listitem").filter({ hasText: words });

    await expect(list.getByRole("heading", { level: 3 })).toHaveText(["Today", "Yesterday", /^\d{1,2} \w+$/]);
    await expect(row("Najmi paid Haziq")).toContainText("RM 130.00");
    await expect(list.getByText("Haziq marked Afiq → Haziq as paid")).toBeVisible();
    await expect(list.getByText("Someone marked Afiq → Haziq as paid")).toBeVisible();
    await expect(list.getByText("Afiq undid their payment to Haziq")).toBeVisible();
    await expect(list.getByText("Haziq updated their bank details")).toBeVisible();
    await expect(row("Haziq changed Hotel")).toContainText("Amount RM 280.00 → RM 300.00");
    await expect(row("Haziq changed Hotel")).toContainText("Split updated");
  });

  test("words every kind of member change, and never stores secrets", async ({ page }) => {
    await seed({ ...trip, items: [hotel, dinner] });
    await openBill(page);
    await submit(await startAdding(page, "Snacks", "1000", "Najmi"));
    await settled(async () => (await serverDoc()).items.length, 3);
    await openBillDetail(page, "Snacks");
    await panel(page).getByRole("button", { name: "Delete bill · you can undo" }).click();
    await settled(async () => (await serverDoc()).items.length, 2);

    await notMe(page);
    await sheet(page).getByRole("button", { name: "Not on the list" }).click();
    const name = panel(page);
    await name.getByPlaceholder("Name").fill("Aiman");
    await name.getByRole("button", { name: "Add", exact: true }).click();
    await settled(async () => (await serverDoc()).people.length, 4);

    await openBills(page);
    await joinButton(page, "Hotel").click();
    await settled(async () => (await serverItem("hotel"))?.participants.length, 4);
    await page.keyboard.press("Escape");

    const list = await openHistory(page);
    const row = (words: string) => list.getByRole("listitem").filter({ hasText: words });
    await expect(row("Najmi added Snacks")).toContainText("Paid by Najmi");
    await expect(row("Najmi added Snacks")).toContainText("RM 10.00");
    await expect(row("Najmi deleted Snacks")).toContainText("RM 10.00");
    await expect(list.getByText("Aiman joined the bill")).toBeVisible();
    await expect(row("Aiman joined Hotel")).toContainText("RM 75.00");

    const stored = JSON.stringify((await getDb()).bill_events);
    expect(stored).not.toContain("deleteHash");
    expect(stored).not.toContain("keyHash");
  });
});
