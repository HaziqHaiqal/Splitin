import { expect, test } from "@playwright/test";
import { sheet } from "./helpers";

const languages = [
  {
    locale: "en",
    settings: "Settings",
    help: "How to use Splitin",
    next: "Next",
    step: "Step 9",
    swap: "Swap the QR",
    warning: "This QR says AMIR BIN ZULKIFLI, not Haziq.",
    add: "+ Add",
    title: "HOUSE BILLS",
    looking: "Just looking",
    pick: "Paid? Tap to pick your name",
    hi: "Hi Afiq",
    scan: "Scan a receipt",
    incl: "INCL. SERVICE 10% · SST 6%",
  },
  {
    locale: "ms",
    settings: "Tetapan",
    help: "Cara menggunakan Splitin",
    next: "Seterusnya",
    step: "Langkah 9",
    swap: "Tukar QR",
    warning: "QR ini tertulis AMIR BIN ZULKIFLI, bukan Haziq.",
    add: "+ Tambah",
    title: "BIL RUMAH",
    looking: "Tengok sahaja",
    pick: "Dah bayar? Ketik untuk pilih nama anda",
    hi: "Hai Afiq",
    scan: "Imbas resit",
    incl: "TERMASUK CAJ PERKHIDMATAN 10% · SST 6%",
  },
  {
    locale: "zh",
    settings: "设置",
    help: "如何使用 Splitin",
    next: "下一步",
    step: "第 9 步",
    swap: "换一个 QR",
    warning: "这个 QR 显示的是 AMIR BIN ZULKIFLI，不是 Haziq。",
    add: "+ 添加",
    title: "家里的账单",
    looking: "只是看看",
    pick: "付了吗？点击选择你的名字",
    hi: "嗨 Afiq",
    scan: "扫描收据",
    incl: "含 服务费 10% · SST 6%",
  },
  {
    locale: "ta",
    settings: "அமைப்புகள்",
    help: "Splitin-ஐப் பயன்படுத்துவது எப்படி",
    next: "அடுத்து",
    step: "படி 9",
    swap: "QR-ஐ மாற்று",
    warning: "இந்த QR-இல் AMIR BIN ZULKIFLI என்று உள்ளது, Haziq அல்ல.",
    add: "+ சேர்",
    title: "வீட்டுப் பில்கள்",
    looking: "சும்மா பார்க்கிறேன்",
    pick: "செலுத்திவிட்டீர்களா? உங்கள் பெயரைத் தேர்வு செய்யத் தட்டவும்",
    hi: "வணக்கம் Afiq",
    scan: "ரசீதை ஸ்கேன் செய்",
    incl: "உட்பட சேவைக் கட்டணம் 10% · SST 6%",
  },
];

for (const {
  locale,
  settings,
  help,
  next,
  step,
  swap,
  warning,
  add,
  title,
  looking,
  pick,
  hi,
  scan,
  incl,
} of languages) {
  test(`the guide's first step prints the names on a receipt (${locale})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "splitin-locale", value: locale, url: baseURL! }]);
    await page.goto("/");
    await page.getByRole("button", { name: settings }).click();
    await page.getByRole("button", { name: help }).click();
    const guide = sheet(page);
    await guide.getByRole("button", { name: next, exact: true }).click();
    await expect(guide.getByText(title)).toBeVisible();
    await expect(guide.getByText("HAZIQ", { exact: true })).toBeVisible();
    await guide.getByRole("button", { name: add }).dispatchEvent("click");
    await expect(guide.getByText("HAZIQ · NAJMI", { exact: true })).toBeVisible();
    await expect(guide.getByText("Najmi", { exact: true })).toBeVisible();
  });

  test(`the guide's name menu hides your name (${locale})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "splitin-locale", value: locale, url: baseURL! }]);
    await page.goto("/");
    await page.getByRole("button", { name: settings }).click();
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

  test(`the guide's bills step scans a receipt (${locale})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "splitin-locale", value: locale, url: baseURL! }]);
    await page.goto("/");
    await page.getByRole("button", { name: settings }).click();
    await page.getByRole("button", { name: help }).click();
    const guide = sheet(page);
    for (let i = 0; i < 2; i++) await guide.getByRole("button", { name: next, exact: true }).click();
    await guide.getByRole("button", { name: scan }).click();
    await expect(guide.getByText("RESTORAN ALI · NAJMI")).toBeVisible();
    await expect(guide.getByText(incl)).toBeVisible();
  });

  test(`the guide's split step adds SST to the total (${locale})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "splitin-locale", value: locale, url: baseURL! }]);
    await page.goto("/");
    await page.getByRole("button", { name: settings }).click();
    await page.getByRole("button", { name: help }).click();
    const guide = sheet(page);
    for (let i = 0; i < 3; i++) await guide.getByRole("button", { name: next, exact: true }).click();
    await expect(guide.getByText("RM 120.00")).toBeVisible();
    await guide.getByRole("checkbox", { name: "SST 6%" }).click();
    await expect(guide.getByText("RM 127.20")).toBeVisible();
    await expect(guide.getByText("+7.20")).toBeVisible();
  });

  test(`the guide teaches paying by QR (${locale})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "splitin-locale", value: locale, url: baseURL! }]);
    await page.goto("/");
    await page.getByRole("button", { name: settings }).click();
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
    await page.getByRole("button", { name: settings }).click();
    await page.getByRole("button", { name: help }).click();
    const guide = sheet(page);
    await expect(guide.locator("[data-step]")).toHaveCount(11);
    for (let i = 0; i < 9; i++) await guide.getByRole("button", { name: next, exact: true }).click();
    await expect(
      guide.getByRole("heading", { name: new RegExp(step) }).or(guide.getByText(step).first()),
    ).toBeVisible();

    const join = guide.getByRole("button", { name: /^(Join|Sertai|加入|இணை) ·/ });
    const leave = guide.getByRole("button", { name: /^(Leave|Keluar dari|退出) |இலிருந்து விலகு$/ });
    await expect(guide.getByText("RM 40.32")).toHaveCount(2);
    await join.first().dispatchEvent("click");
    await expect(guide.getByText("RM 76.32")).toBeVisible();
    await join.first().dispatchEvent("click");
    await expect(guide.getByText("RM 94.76")).toBeVisible();
    for (let i = 0; i < 3; i++) await leave.first().dispatchEvent("click");
    await expect(guide.getByText("RM 0.00")).toBeVisible();
    await expect(join).toHaveCount(3);
  });
}
