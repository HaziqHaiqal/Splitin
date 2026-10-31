import { expect, test, type Page } from "@playwright/test";
import {
  addName,
  BILL,
  button,
  choose,
  closePhones,
  collide,
  dinner,
  eventKinds,
  getDb,
  hotel,
  newPhone,
  openAs,
  openBill,
  openFresh,
  openHistory,
  openJoin,
  panel,
  patchDoc,
  paymentRow,
  paymentsOf,
  payLine,
  pickMe,
  saveDb,
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
      expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
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
    await expect(button(page, "Delete")).toBeVisible();

    await button(page, "Hi Najmi").click();
    const list = sheet(page);
    await expect(list.getByRole("button", { name: "Afiq" })).toBeVisible();
    await expect(list.getByRole("button", { name: "Najmi" })).toHaveCount(0);
    await list.getByRole("button", { name: "Just looking" }).click();

    await expect(button(page, "Hi Najmi")).toHaveCount(0);
    await expect(button(page, "Paid? Tap to pick your name")).toBeVisible();
    await expect(button(page, "Delete")).toBeVisible();
    expect(await page.evaluate((id) => localStorage.getItem(`splitin:me:${id}`), BILL)).toBeNull();

    await choose(page, "Join bill");
    await expect(sheet(page).getByRole("button", { name: "Najmi" })).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: "Just looking" })).toHaveCount(0);
  });

  test("the name sits above the receipt, with History below and a flat bar", async ({ page }) => {
    await openAs(page, "Najmi");
    await expect(button(page, "Add bill")).toBeVisible();
    await expect(button(page, /^History/)).toBeVisible();

    const name = (await button(page, "Hi Najmi").boundingBox())!;
    const paper = (await text(page, "HOTEL").boundingBox())!;
    const history = (await button(page, /^History/).boundingBox())!;
    expect(name.y).toBeLessThan(paper.y);
    expect(history.y).toBeGreaterThan(paper.y);

    const main = button(page, "Add bill");
    const bar = (await main.locator("../..").boundingBox())!;
    expect([bar.x, bar.width, bar.y + bar.height]).toEqual([0, 390, 844]);
    expect(await main.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
  });

  test("someone already in every bill only gets Add bill", async ({ page }) => {
    await openAs(page, "Najmi");
    await expect(button(page, "Add bill")).toBeVisible();
    await expect(button(page, "Join bill")).toHaveCount(0);
  });

  test("before a name is chosen, both buttons show", async ({ page }) => {
    await openBill(page);
    await expect(button(page, "Add bill")).toBeVisible();
    await expect(button(page, "Join bill")).toBeVisible();
  });

  test("Add bill and Join bill open their forms straight away", async ({ page }) => {
    await seed({ ...trip, items: [hotel, { ...dinner, participants: ["h", "a"] }] });
    await openAs(page, "Najmi");
    await button(page, "Add bill").click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(panel(page).getByText("Add what you paid")).toBeVisible();
    await panel(page).getByRole("button", { name: "Cancel" }).click();

    await button(page, "Join bill").click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(panel(page).getByText("Which bills are you in?")).toBeVisible();
  });

  test("with no bills yet the button only adds", async ({ page }) => {
    await seed({ ...trip, items: [] });
    await openBill(page);
    await expect(button(page, "Join bill")).toHaveCount(0);
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
    await collide();
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

  test("bank details: only on the phone that added the name", async ({ page, browser }) => {
    await openBill(page);
    await choose(page, "Add bill");
    await addName(page, "Aiman");
    await expect(panel(page).getByText("Add what you paid")).toBeVisible();
    await panel(page).getByRole("button", { name: "Cancel" }).click();
    await button(page, "Bank details").click();
    const form = panel(page);
    await form.getByRole("button", { name: "Maybank" }).click();
    await form.locator("input[inputmode='numeric']").fill("1234567890");
    await submit(form);
    await settled(async () => (await serverDoc()).people[3].bank, "Maybank");
    expect((await serverDoc()).people[3].accountNo).toBe("1234567890");
    expect(JSON.stringify((await getDb()).bill_events)).not.toContain("1234567890");

    const other = await newPhone(browser);
    await openBill(other);
    await expect(button(other, "Add bill")).toBeVisible();
    await expect(button(other, "Bank details")).toHaveCount(0);
  });
});

test.describe("adding a bill", () => {
  test("a friend adds what they paid, and can undo", async ({ page }) => {
    await openBill(page);
    const form = await startAdding(page, "Petrol", "6000", "Najmi");
    await expect(form.locator("input[inputmode='numeric']")).toHaveValue("60.00");
    await submit(form);
    await expect(text(page, "PETROL")).toBeVisible();
    await settled(itemNames, ["Hotel", "Petrol"]);
    const petrol = (await serverDoc()).items[1];
    expect(petrol.addedAt).toBeTruthy();
    expect(petrol.deleteHash).toBeTruthy();

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
    await choose(page, "Join bill");
    await addName(page, "Aiman");
    const join = panel(page);
    await join.getByRole("checkbox", { name: "Hotel" }).click();
    await submit(join);
    await settled(async () => (await serverItem("hotel"))?.participants.length, 4);

    await submit(await startAdding(page, "Toll", "500"));
    await settled(async () => (await serverDoc()).items.length, 3);
    expect((await serverDoc()).items[2].participants).toHaveLength(4);
  });

  test("friends delete only their own bills", async ({ browser }) => {
    const mine = await newPhone(browser);
    const stranger = await newPhone(browser);
    await openBill(mine);
    await submit(await startAdding(mine, "Snacks", "1000", "Najmi"));
    await settled(itemNames, ["Hotel", "Snacks"]);
    const snacks = (await serverDoc()).items[1];

    await openBill(stranger);
    await expect(button(stranger, "Add bill")).toBeVisible();
    await expect(stranger.getByText("You added")).toHaveCount(0);

    await stranger.evaluate(
      ([billId, itemId]) => {
        localStorage.setItem(
          `splitin:mine:${billId}`,
          JSON.stringify({ [itemId]: "forgedforgedforgedforgedforged12", hotel: "forgedforgedforgedforgedforged12" }),
        );
      },
      [BILL, snacks.id],
    );
    await openBill(stranger);
    await button(stranger, "Delete").click();
    await pickMe(stranger, "Afiq");
    await expect(text(stranger, "Something went wrong")).toBeVisible();
    await expect(stranger.getByRole("button", { name: "Delete" })).toHaveCount(1);
    expect(await itemNames()).toEqual(["Hotel", "Snacks"]);

    await openBill(mine);
    await button(mine, "Delete").click();
    await settled(itemNames, ["Hotel"]);
    await button(mine, "Undo").click();
    await settled(itemNames, ["Hotel", "Snacks"]);
    await expect(button(mine, "Delete")).toBeVisible();
  });

  test("two friends adding at the same moment both survive", async ({ browser }) => {
    const a = await newPhone(browser);
    const b = await newPhone(browser);
    await openBill(a);
    await openBill(b);
    const first = await startAdding(a, "Snacks", "1000", "Najmi");
    const second = await startAdding(b, "Parking", "2000", "Afiq");
    await collide();
    await Promise.all([submit(first), submit(second)]);
    await settled(async () => (await itemNames()).sort(), ["Hotel", "Parking", "Snacks"]);
  });
});

test.describe("joining bills", () => {
  test.beforeEach(() => seed({ ...trip, items: [hotel, dinner] }));

  const startJoining = async (page: import("@playwright/test").Page) => {
    await openBill(page);
    await choose(page, "Join bill");
    await addName(page, "Aiman");
    const form = panel(page);
    await expect(form.getByText("Which bills are you in?")).toBeVisible();
    return form;
  };
  const me = async () => (await serverDoc()).people.find((p) => p.name === "Aiman")!.id;

  test("joins one bill with an automatic share, then undo", async ({ page }) => {
    const form = await startJoining(page);
    await form.getByRole("checkbox", { name: "Hotel" }).click();
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
    await form.getByRole("checkbox", { name: "Hotel" }).click();
    await submit(form);
    const id = await me();
    await settled(async () => (await serverItem("hotel"))?.participants.includes(id), true);

    await expect(text(page, "you pay RM 75.00")).toBeVisible();
    await button(page, "Change").click();
    form = panel(page);
    await form.getByRole("button", { name: "Your amount for Hotel" }).click();
    const input = form.getByRole("textbox", { name: "Your amount for Hotel" });
    await input.fill("");
    await input.pressSequentially("4000");
    await input.press("Enter");
    await submit(form);
    await settled(async () => (await serverItem("hotel"))?.overrides[id], 4000);
    expect(await eventKinds()).toContain("share_changed");

    await button(page, "Change").click();
    form = panel(page);
    await form.getByRole("checkbox", { name: "Hotel" }).click();
    await submit(form);
    await settled(async () => (await serverItem("hotel"))?.participants.includes(id), false);
    expect(await eventKinds()).toContain("bill_left");
    await expect(page.getByText("you pay")).toHaveCount(0);
  });

  test("a bill you were already in is fixed and cannot be left", async ({ page }) => {
    await openBill(page);
    const form = await openJoin(page, "Najmi");
    const hotelBox = form.getByRole("checkbox", { name: "Hotel" });
    await expect(hotelBox).toBeDisabled();
    await expect(form.getByText("You're in this bill").first()).toBeVisible();
    await expect(form.getByRole("button", { name: "Join all" })).toHaveCount(0);
  });

  test("a bill with every amount set cannot be joined", async ({ page }) => {
    await seed({
      ...trip,
      items: [{ ...hotel, participants: ["h", "n"], overrides: { h: 10000, n: 20000 } }],
    });
    const form = await startJoining(page);
    await expect(form.getByRole("checkbox", { name: "Hotel" })).toBeDisabled();
    await expect(form.getByText("Every amount is set. Ask Haziq.")).toBeVisible();
  });

  test("someone who already paid too much gets paid back", async ({ page }) => {
    await seed(trip, { payments: [paymentRow("n", "h", 10000)] });
    await openBill(page);
    const form = await (async () => {
      await choose(page, "Join bill");
      await addName(page, "Aiman");
      const panelForm = panel(page);
      await expect(panelForm.getByText("Which bills are you in?")).toBeVisible();
      return panelForm;
    })();
    await form.getByRole("checkbox", { name: "Hotel" }).click();
    await submit(form);
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

  test("a friend cannot mark the owner's own payment", async ({ page }) => {
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

      const db = await getDb();
      db.payments[0].created_at = new Date(Date.now() - 20 * 86_400_000).toISOString();
      await saveDb(db);
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

    test("the toast's Undo clears the saved key too", async ({ page }) => {
      await openAs(page, "Najmi");
      await markPaid(page);
      await button(page, "Undo").click();
      await settled(paymentsOf, []);
      await expect(text(page, "Najmi → Haziq is unpaid again")).toBeVisible();
      await expect(button(page, /NAJMI PAYS HAZIQ 100\.00$/)).toBeVisible();
      expect(await page.evaluate((id) => localStorage.getItem(`splitin:paid:${id}`), BILL)).toBe("{}");
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

    for (const markedBy of ["owner", "payer"])
      test(`a payment with no saved key (marked by ${markedBy}) stays as it is`, async ({ page }) => {
        await seed(trip, { payments: [paymentRow("n", "h", 10000, markedBy)] });
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

    test("the server refuses a made-up key", async ({ page }) => {
      const row = paymentRow("n", "h", 10000);
      await seed(trip, { payments: [row] });
      await page.addInitScript(
        ([id, paymentId]) => localStorage.setItem(`splitin:paid:${id}`, JSON.stringify({ [paymentId]: "made-up" })),
        [BILL, row.id],
      );
      await openAs(page, "Najmi");
      await payLine(page, "NAJMI", "HAZIQ").click();
      await sheet(page).getByRole("button", { name: "Mark unpaid" }).click();
      await expect(text(page, "Something went wrong")).toBeVisible();
      expect(await paymentsOf()).toEqual([paid]);
    });

    test("the server refuses when the owner has taken over the payment", async ({ page }) => {
      await openAs(page, "Najmi");
      await markPaid(page);
      const db = await getDb();
      db.payments[0].marked_by = "owner";
      await saveDb(db);
      await payLine(page, "NAJMI", "HAZIQ").click();
      await sheet(page).getByRole("button", { name: "Mark unpaid" }).click();
      await expect(text(page, "Something went wrong")).toBeVisible();
      expect(await paymentsOf()).toEqual([paid]);
    });

    test("a payment the owner already undid just clears", async ({ page }) => {
      await openAs(page, "Najmi");
      await markPaid(page);
      const db = await getDb();
      db.payments = [];
      await saveDb(db);
      await payLine(page, "NAJMI", "HAZIQ").click();
      await sheet(page).getByRole("button", { name: "Mark unpaid" }).click();
      await expect(text(page, "Najmi → Haziq is unpaid again")).toBeVisible();
      await expect(button(page, /NAJMI PAYS HAZIQ 100\.00$/)).toBeVisible();
    });

    test("a part payment can be undone while the rest stays open", async ({ page }) => {
      await openAs(page, "Najmi");
      await payLine(page, "NAJMI", "HAZIQ").click();
      await sheet(page).getByRole("button", { name: "I paid a different amount" }).click();
      const form = panel(page);
      await form.locator("input[inputmode='numeric']").pressSequentially("6000");
      await submit(form);
      await settled(paymentsOf, [{ ...paid, amountMinor: 6000 }]);

      await button(page, /NAJMI PAYS HAZIQ 40\.00$/).click();
      await expect(sheet(page).getByRole("heading", { name: "Najmi paid Haziq?" })).toBeVisible();
      await sheet(page).getByRole("button", { name: "Cancel" }).click();
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
    await sheet(page).getByRole("button", { name: "I paid a different amount" }).click();
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
    await sheet(page).getByRole("button", { name: "I paid a different amount" }).click();
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

  test("the server refuses an undo with a forged key", async ({ page }) => {
    await openAs(page, "Najmi");
    await payLine(page, "NAJMI", "HAZIQ").click();
    await sheet(page).getByRole("button", { name: "Mark paid" }).click();
    await settled(paymentsOf, [{ from: "n", to: "h", amountMinor: 10000 }]);

    await page.route("**/bill/**", async (route) => {
      const body = route.request().postData();
      if (route.request().method() === "POST" && body?.includes("undoKey")) {
        await route.continue({ postData: body.replace(/"undoKey":"[^"]+"/, '"undoKey":"forged"') });
      } else await route.continue();
    });
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

  test("locking while a friend has the form open refuses the save", async ({ page }) => {
    await openBill(page);
    const form = await startAdding(page, "Snacks", "1000", "Najmi");
    await patchDoc((d) => ({ ...d, locked: true }));
    await submit(form);
    await expect(text(page, "This bill is locked. You can still mark payments.")).toBeVisible();
    expect(await itemNames()).toEqual(["Hotel"]);
  });

  test("too many friend changes on one bill are refused", async ({ page }) => {
    const bill_events = Array.from({ length: 100 }, (_, i) => ({
      id: `e${i}`,
      bill_id: BILL,
      kind: "item_added",
      actor: "friend",
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
    expect(decodeURIComponent(opened)).toContain(`/bill/${BILL}`);
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

  test("the page still works without the history table", async ({ page }) => {
    await seed(trip, { bill_events: null });
    await openBill(page);
    await expect(button(page, /^History/)).toBeVisible();
    const list = await openHistory(page);
    await expect(list.getByText("No changes recorded yet")).toBeVisible();
    await openBill(page);
    await submit(await startAdding(page, "Snacks", "1000", "Najmi"));
    await settled(itemNames, ["Hotel", "Snacks"]);
  });
});
