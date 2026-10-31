import { expect, test } from "@playwright/test";
import { sheet } from "./helpers";

const languages = [
  {
    locale: "en",
    help: "How to use Splitin",
    next: "Next",
    step: "Step 8",
    all: "Join all",
    none: "Untick all",
    looking: "Just looking",
    choose: "Choose my name",
    hi: "Hi Afiq!",
    notAfiq: "Not Afiq?",
    clear: "Clear",
  },
  {
    locale: "ms",
    help: "Cara menggunakan Splitin",
    next: "Seterusnya",
    step: "Langkah 8",
    all: "Sertai semua",
    none: "Nyahtanda semua",
    looking: "Tengok sahaja",
    choose: "Pilih nama saya",
    hi: "Hai Afiq!",
    notAfiq: "Bukan Afiq?",
    clear: "Kosongkan",
  },
];

for (const { locale, help, next, step, all, none, looking, choose, hi, notAfiq, clear } of languages) {
  test(`the guide shows Not X? without your name, with Clear (${locale})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "splitin-locale", value: locale, url: baseURL! }]);
    await page.goto("/");
    await page.getByRole("button", { name: help }).click();
    const guide = sheet(page);
    for (let i = 0; i < 6; i++) await guide.getByRole("button", { name: next, exact: true }).click();
    await expect(guide.getByRole("button", { name: looking })).toBeVisible();
    await guide.getByRole("button", { name: "Afiq" }).click();
    await expect(guide.getByText(hi)).toBeVisible();
    await guide.getByRole("button", { name: notAfiq }).click();
    await expect(guide.getByRole("button", { name: "Najmi" })).toBeVisible();
    await expect(guide.getByRole("button", { name: "Afiq" })).toHaveCount(0);
    await guide.getByRole("button", { name: clear, exact: true }).click();
    await expect(guide.getByRole("button", { name: choose })).toBeVisible();
    await expect(guide.getByRole("button", { name: next, exact: true })).toBeInViewport();
  });

  test(`the guide teaches joining a bill (${locale})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "splitin-locale", value: locale, url: baseURL! }]);
    await page.goto("/");
    await page.getByRole("button", { name: help }).click();
    const guide = sheet(page);
    await expect(guide.locator("[data-step]")).toHaveCount(10);
    for (let i = 0; i < 8; i++) await guide.getByRole("button", { name: next, exact: true }).click();
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
