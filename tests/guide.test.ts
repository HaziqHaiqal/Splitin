import { expect, test } from "@playwright/test";
import { sheet } from "./helpers";

const languages = [
  {
    locale: "en",
    help: "How to use Splitin",
    next: "Next",
    step: "Step 9",
    swap: "Swap the QR",
    warning: "This QR says AMIR BIN ZULKIFLI, not Haziq.",
    all: "Join all",
    none: "Untick all",
    looking: "Just looking",
    pick: "Paid? Tap to pick your name",
    hi: "Hi Afiq",
  },
  {
    locale: "ms",
    help: "Cara menggunakan Splitin",
    next: "Seterusnya",
    step: "Langkah 9",
    swap: "Tukar QR",
    warning: "QR ini tertulis AMIR BIN ZULKIFLI, bukan Haziq.",
    all: "Sertai semua",
    none: "Nyahtanda semua",
    looking: "Tengok sahaja",
    pick: "Dah bayar? Ketik untuk pilih nama anda",
    hi: "Hai Afiq",
  },
];

for (const { locale, help, next, step, swap, warning, all, none, looking, pick, hi } of languages) {
  test(`the guide's name menu hides your name (${locale})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "splitin-locale", value: locale, url: baseURL! }]);
    await page.goto("/");
    await page.getByRole("button", { name: help }).click();
    const guide = sheet(page);
    for (let i = 0; i < 6; i++) await guide.getByRole("button", { name: next, exact: true }).click();
    await expect(guide.getByRole("button", { name: looking })).toBeVisible();
    await guide.getByRole("button", { name: "Afiq" }).click();
    await guide.getByRole("button", { name: hi }).click();
    await expect(guide.getByRole("button", { name: "Najmi" })).toBeVisible();
    await expect(guide.getByRole("button", { name: "Afiq" })).toHaveCount(0);
    await guide.getByRole("button", { name: looking }).click();
    await expect(guide.getByRole("button", { name: pick })).toBeVisible();
    await expect(guide.getByRole("button", { name: next, exact: true })).toBeInViewport();
  });

  test(`the guide teaches paying by QR (${locale})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "splitin-locale", value: locale, url: baseURL! }]);
    await page.goto("/");
    await page.getByRole("button", { name: help }).click();
    const guide = sheet(page);
    for (let i = 0; i < 7; i++) await guide.getByRole("button", { name: next, exact: true }).click();
    await guide.getByRole("button", { name: swap }).dispatchEvent("click");
    await expect(guide.getByText(warning)).toBeVisible();
    await expect(guide.getByRole("button", { name: next, exact: true })).toBeInViewport();
  });

  test(`the guide teaches joining a bill (${locale})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "splitin-locale", value: locale, url: baseURL! }]);
    await page.goto("/");
    await page.getByRole("button", { name: help }).click();
    const guide = sheet(page);
    await expect(guide.locator("[data-step]")).toHaveCount(11);
    for (let i = 0; i < 9; i++) await guide.getByRole("button", { name: next, exact: true }).click();
    await expect(
      guide.getByRole("heading", { name: new RegExp(step) }).or(guide.getByText(step).first()),
    ).toBeVisible();

    await expect(guide.getByText("RM 40.32").nth(1)).toBeVisible();
    await guide.getByRole("checkbox").nth(1).click();
    await expect(guide.getByText("RM 76.32")).toBeVisible();
    await guide.getByRole("button", { name: all }).dispatchEvent("click");
    await expect(guide.getByText("RM 94.76")).toBeVisible();
    await guide.getByRole("button", { name: none }).click();
    await expect(guide.getByText("RM 0.00")).toBeVisible();
  });
}
