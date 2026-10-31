import { expect, test } from "@playwright/test";
import {
  addName,
  BILL,
  button,
  choose,
  closePhones,
  dinner,
  eventKinds,
  fromMore,
  getDb,
  hotel,
  newPhone,
  OLD,
  openAs,
  openBill,
  openHistory,
  openJoin,
  ownerStorage,
  panel,
  paymentRow,
  paymentsOf,
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
} from "./helpers";

test.beforeEach(() => seed());
test.afterEach(() => closePhones());

const openDraft = (doc = trip) => ({ "splitin:draft:v2": { doc, billId: null, seenAt: "" } });

test.describe("starting a bill", () => {
  const savedDraft = (page: import("@playwright/test").Page) =>
    page.evaluate(() => JSON.parse(localStorage.getItem("splitin:draft:v2") ?? "null"));
  const billName = (page: import("@playwright/test").Page) => page.getByLabel("Bill name");
  const names = (page: import("@playwright/test").Page) => page.getByLabel("Who's splitting?");

  test("the bill name is empty and required", async ({ page }) => {
    await page.goto("/");
    await expect(billName(page)).toHaveValue("");
    await names(page).fill("Najmi, Afiq");
    await button(page, "Add").click();
    await expect(text(page, "Give this bill a name first.")).toBeVisible();
    await expect(billName(page)).toBeFocused();
    expect(await savedDraft(page)).toBeNull();

    await billName(page).fill("House bills");
    await expect(page.getByText("Give this bill a name first.")).toHaveCount(0);
    await button(page, "Add").click();
    await expect(page.getByRole("button", { name: "Edit title" })).toHaveText("House bills");
    const draft = await savedDraft(page);
    expect(draft.doc.title).toBe("House bills");
    expect(draft.doc.people.map((p: { name: string }) => p.name)).toEqual(["Najmi", "Afiq"]);
  });

  test("Enter on the bill name moves to the names", async ({ page }) => {
    await page.goto("/");
    await billName(page).fill("Trip");
    await billName(page).press("Enter");
    await expect(names(page)).toBeFocused();
    expect(await savedDraft(page)).toBeNull();
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

    const friend = await newPhone(browser);
    await friend.goto(`/bill/${published.id}`);
    await expect(text(friend, "SHARED BY NAJMI")).toBeAttached();
    const who = sheet(friend);
    await expect(who.getByRole("button", { name: "Haziq" })).toBeVisible();
    await expect(who.getByRole("button", { name: "Najmi" })).toHaveCount(0);
  });

  test("the owner can say they are not on the list", async ({ browser }) => {
    const { ownerId, ...doc } = trip;
    void ownerId;
    const owner = await newPhone(browser, openDraft(doc));
    await owner.goto("/");
    await button(owner, "Share receipt").click();
    await sheet(owner).getByRole("button", { name: "Not on the list" }).click();
    await expect(sheet(owner).getByText("Copy link")).toBeVisible();
    const published = (await getDb()).bills.find((b) => b.id !== BILL)!;
    expect(published.doc.ownerId).toBeNull();
  });

  test("a bill shared before this feature is not asked again", async ({ browser }) => {
    const { ownerId, ...doc } = trip;
    void ownerId;
    await seed(doc);
    const owner = await newPhone(browser, ownerStorage(doc));
    await owner.goto("/");
    await button(owner, "Share receipt").click();
    await expect(sheet(owner).getByText("Copy link")).toBeVisible();
    await expect(owner.getByRole("heading", { name: "Which one is you?" })).toHaveCount(0);
  });
});

test.describe("saving over friends' changes", () => {
  test("an old copy on the owner's phone loses nothing a friend did", async ({ browser }) => {
    await seed({ ...trip, items: [hotel, dinner] });
    const owner = await newPhone(browser, ownerStorage({ ...trip, items: [hotel, dinner] }, OLD));
    await owner.goto("/");
    await expect(text(owner, "HOTEL")).toBeVisible();

    const friend = await newPhone(browser);
    await openBill(friend);
    await choose(friend, "Join bill");
    await addName(friend, "Aiman");
    const form = panel(friend);
    await form.getByRole("checkbox", { name: "Hotel" }).click();
    await submit(form);
    await settled(async () => (await serverItem("hotel"))?.participants.length, 4);
    await openBill(friend);
    await submit(await startAdding(friend, "Snacks", "1000"));
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
    const ownerEvents = (await getDb()).bill_events.filter((e) => e.actor === "owner").map((e) => e.kind);
    expect(ownerEvents).toEqual(["title_changed"]);

    await expect
      .poll(() =>
        owner.evaluate(() => JSON.parse(localStorage.getItem("splitin:draft:v2")!).doc.people.length as number),
      )
      .toBe(4);
  });

  test("the owner's delete stays deleted, and a friend's later bill still arrives", async ({ browser }) => {
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

    const friend = await newPhone(browser);
    await openBill(friend);
    await submit(await startAdding(friend, "Toll", "500", "Najmi"));
    await settled(async () => (await serverDoc()).items.map((i) => i.name), ["Hotel", "Toll"]);

    await owner.goto("/");
    await expect(text(owner, "TOLL")).toBeVisible();
    await expect(owner.getByText("DINNER")).toHaveCount(0);
  });
});

test.describe("owner screen", () => {
  const tracking = async (browser: import("@playwright/test").Browser, doc = trip) => {
    const owner = await newPhone(browser, ownerStorage(doc));
    await openBill(owner);
    await expect(button(owner, "View receipt")).toBeVisible();
    return owner;
  };

  test("greets the owner, with no way to change the name", async ({ browser }) => {
    const owner = await tracking(browser);
    await expect(text(owner, "Hi Haziq")).toBeVisible();
    await expect(button(owner, "Hi Haziq")).toHaveCount(0);
    await expect(owner.getByRole("heading", { name: "Who are you?" })).toHaveCount(0);
  });

  test("an older bill with no owner saved has no greeting", async ({ browser }) => {
    const { ownerId, ...doc } = trip;
    void ownerId;
    await seed(doc);
    const owner = await tracking(browser, doc);
    await expect(owner.getByText(/^Hi /)).toHaveCount(0);
  });

  test("marks paid and unpaid, naming the owner in History", async ({ browser }) => {
    const owner = await tracking(browser);
    await button(owner, "Mark paid").first().click();
    await settled(async () => (await paymentsOf()).length, 1);
    await button(owner, "Mark unpaid").click();
    await settled(paymentsOf, []);
    await settled(async () => (await eventKinds()).sort(), ["paid", "unpaid"]);
    const list = await openHistory(owner);
    await expect(list.getByText(/Haziq marked/)).toBeVisible();
    await expect(list.getByText(/Haziq undid the payment/)).toBeVisible();
  });

  test("a payment already removed elsewhere shows no error and is not logged twice", async ({ browser }) => {
    const owner = await tracking(browser);
    await button(owner, "Mark paid").first().click();
    await expect(button(owner, "Mark unpaid")).toBeVisible();
    const db = await getDb();
    await fetch("http://localhost:54399/__db", { method: "POST", body: JSON.stringify({ ...db, payments: [] }) });
    await button(owner, "Mark unpaid").click();
    await expect(text(owner, "is unpaid again")).toBeVisible();
    await expect(owner.getByText("Something went wrong")).toHaveCount(0);
    expect(await eventKinds()).toEqual(["paid"]);
  });

  test("records a different amount", async ({ browser }) => {
    const owner = await tracking(browser);
    await fromMore(owner, "Record a different amount");
    const form = panel(owner);
    await form.getByRole("button", { name: "Najmi" }).first().click();
    await form.getByRole("button", { name: "Haziq" }).nth(1).click();
    await form.locator("input[inputmode='numeric']").pressSequentially("2500");
    await submit(form);
    await settled(paymentsOf, [{ from: "n", to: "h", amountMinor: 2500 }]);
  });

  test("names the friend who paid", async ({ browser, page }) => {
    await openAs(page, "Afiq");
    await page.getByRole("button", { name: /AFIQ PAYS HAZIQ/ }).click();
    await sheet(page).getByRole("button", { name: "Mark paid" }).click();
    await settled(async () => (await paymentsOf()).length, 1);

    const owner = await tracking(browser);
    await expect(text(owner, /Afiq tapped paid/)).toBeVisible();
  });

  test("locks and unlocks the bill", async ({ browser, page }) => {
    const owner = await tracking(browser);
    await fromMore(owner, "Lock bill");
    await settled(async () => (await serverDoc()).locked, true);
    await openBill(page);
    await expect(text(page, "Haziq locked this bill")).toBeVisible();

    await fromMore(owner, "Unlock bill");
    await settled(async () => (await serverDoc()).locked, undefined);
    await openBill(page);
    await expect(button(page, "Add bill")).toBeVisible();
    expect(await eventKinds()).toEqual(expect.arrayContaining(["locked", "unlocked"]));
  });

  test("shows a banner for friends' changes only", async ({ browser, page }) => {
    const owner = await tracking(browser);
    await fromMore(owner, "Lock bill");
    await settled(async () => (await serverDoc()).locked, true);
    await fromMore(owner, "Unlock bill");
    await settled(async () => (await serverDoc()).locked, undefined);
    await openBill(owner);
    await expect(button(owner, "View receipt")).toBeVisible();
    await expect(owner.getByText(/since your last visit/)).toHaveCount(0);

    await openBill(page);
    await submit(await startAdding(page, "Snacks", "1000", "Najmi"));
    await settled(async () => (await serverDoc()).items.length, 2);
    await openBill(owner);
    await expect(text(owner, "1 change since your last visit")).toBeVisible();
  });

  test("the paid-off page keeps History and the owner's buttons", async ({ browser }) => {
    await seed(trip, { payments: [paymentRow("n", "h", 10000), paymentRow("a", "h", 10000)] });
    const owner = await newPhone(browser, ownerStorage());
    await openBill(owner);
    await expect(text(owner, "Everyone")).toBeVisible();
    await expect(text(owner, "Hi Haziq")).toBeVisible();
    await expect(button(owner, /^History/)).toBeVisible();
    await owner.getByRole("button", { name: "More", exact: true }).click();
    await expect(sheet(owner).getByRole("button", { name: "Copy owner link" })).toBeVisible();
    await expect(sheet(owner).getByRole("button", { name: "Lock bill" })).toBeVisible();
    await expect(sheet(owner).getByRole("button", { name: "Record a different amount" })).toHaveCount(0);
  });
});

test.describe("owner link and editing", () => {
  test("a new phone becomes the owner through the private link", async ({ browser }) => {
    const phone = await newPhone(browser);
    await phone.goto(`/bill/${BILL}#owner=${TOKEN}`);
    await expect(text(phone, "You can edit this bill on this device now")).toBeVisible();
    await expect(button(phone, "View receipt")).toBeVisible();
    expect(await phone.evaluate((id) => localStorage.getItem(`splitin:asked:${id}`), BILL)).toBeNull();
    expect(phone.url()).not.toContain("owner=");
  });

  test("a wrong token gives nothing", async ({ browser }) => {
    const phone = await newPhone(browser);
    await phone.goto(`/bill/${BILL}#owner=wrongwrongwrongwrongwrong`);
    await expect(text(phone, "Something went wrong")).toBeVisible();
    await expect(button(phone, "Add bill")).toBeVisible();
    await expect(phone.getByRole("heading", { name: "Who are you?" })).toHaveCount(0);
    expect(await phone.evaluate((id) => localStorage.getItem(`splitin:owner:${id}`), BILL)).toBeNull();
  });

  test("Owner link copies the private link", async ({ browser }) => {
    const owner = await newPhone(browser, ownerStorage());
    await owner.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await openBill(owner);
    await fromMore(owner, "Copy owner link");
    await expect(text(owner, "Copied")).toBeVisible();
    expect(await owner.evaluate(() => navigator.clipboard.readText())).toContain(`#owner=${TOKEN}`);
  });

  test("Edit bills brings the shared bill back to a phone that lost it", async ({ browser }) => {
    const phone = await newPhone(browser, { [`splitin:owner:${BILL}`]: TOKEN });
    await openBill(phone);
    await button(phone, "Edit bills").click();
    await expect(phone).toHaveURL(/\/$/);
    await expect(text(phone, "HOTEL")).toBeVisible();
    const draft = await phone.evaluate(() => JSON.parse(localStorage.getItem("splitin:draft:v2")!));
    expect(draft.billId).toBe(BILL);
  });

  test("Edit bills warns before replacing a split not yet shared", async ({ browser }) => {
    const other = { ...trip, title: "Unshared", items: [] };
    const phone = await newPhone(browser, {
      [`splitin:owner:${BILL}`]: TOKEN,
      "splitin:draft:v2": { doc: other, billId: null, seenAt: "" },
    });
    await openBill(phone);
    await button(phone, "Edit bills").click();
    const confirm = sheet(phone);
    await expect(confirm.getByRole("heading", { name: "Replace your unshared split?" })).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    expect(await phone.evaluate(() => JSON.parse(localStorage.getItem("splitin:draft:v2")!).billId)).toBeNull();

    await button(phone, "Edit bills").click();
    await sheet(phone).getByRole("button", { name: "Replace it" }).click();
    await expect(text(phone, "HOTEL")).toBeVisible();
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

test.describe("History", () => {
  test("reads like a group chat", async ({ page }) => {
    const event = (kind: string, minutesAgo: number, data: Record<string, unknown>) => ({
      id: crypto.randomUUID(),
      bill_id: BILL,
      kind,
      actor: "friend",
      created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
      data,
    });
    await seed(trip, {
      bill_events: [
        event("paid", 1, { from: "Najmi", to: "Haziq", amountMinor: 10000, by: "Najmi" }),
        event("item_added", 2, { name: "Snacks", amountMinor: 1000, payer: "Najmi", by: "Najmi" }),
        event("person_joined", 3, { name: "Aiman" }),
        event("unpaid", 4, { from: "Afiq", to: "Haziq", amountMinor: 10000, by: "Afiq" }),
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
    const event = (kind: string, actor: string, data: Record<string, unknown>, created_at: string) => ({
      id: crypto.randomUUID(),
      bill_id: BILL,
      kind,
      actor,
      data,
      created_at,
    });
    await seed(trip, {
      bill_events: [
        event("paid", "friend", { from: "Najmi", to: "Haziq", amountMinor: 13000, by: "Najmi" }, noon(0)),
        event("paid", "owner", { from: "Afiq", to: "Haziq", amountMinor: 4000 }, noon(0)),
        event("paid", "friend", { from: "Afiq", to: "Haziq", amountMinor: 500 }, noon(0)),
        event("unpaid", "friend", { from: "Afiq", to: "Haziq", amountMinor: 4000, by: "Afiq" }, noon(1)),
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
    await expect(list.getByText("A friend marked Afiq → Haziq as paid")).toBeVisible();
    await expect(list.getByText("Afiq undid their payment to Haziq")).toBeVisible();
    await expect(list.getByText("Haziq updated their bank details")).toBeVisible();
    await expect(row("Haziq changed Hotel")).toContainText("Amount RM 280.00 → RM 300.00");
    await expect(row("Haziq changed Hotel")).toContainText("Split updated");
  });

  test("words every kind of friend change, and never stores secrets", async ({ page }) => {
    await seed({ ...trip, items: [hotel, dinner] });
    await openBill(page);
    await submit(await startAdding(page, "Snacks", "1000", "Najmi"));
    await settled(async () => (await serverDoc()).items.length, 3);
    await expect(button(page, "Delete")).toBeVisible();
    await button(page, "Delete").click();
    await settled(async () => (await serverDoc()).items.length, 2);

    await button(page, "Hi Najmi").click();
    await sheet(page).getByRole("button", { name: "Not on the list" }).click();
    const name = panel(page);
    await name.getByPlaceholder("Name").fill("Aiman");
    await name.getByRole("button", { name: "Add", exact: true }).click();
    await settled(async () => (await serverDoc()).people.length, 4);

    const join = await openJoin(page);
    await join.getByRole("checkbox", { name: "Hotel" }).click();
    await submit(join);
    await settled(async () => (await serverItem("hotel"))?.participants.length, 4);

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
