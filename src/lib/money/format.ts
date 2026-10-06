export const CURRENCIES = [
  "MYR",
  "SGD",
  "IDR",
  "THB",
  "BND",
  "PHP",
  "VND",
  "JPY",
  "KRW",
  "CNY",
  "HKD",
  "TWD",
  "AUD",
  "GBP",
  "EUR",
  "USD",
  "SAR",
  "AED",
  "TRY",
  "INR",
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export function isCurrency(code: string): code is CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(code);
}

const digitsCache = new Map<string, number>();

/** Number of minor-unit digits, e.g. MYR → 2, JPY → 0. */
export function currencyDigits(currency: string): number {
  let digits = digitsCache.get(currency);
  if (digits === undefined) {
    digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    digitsCache.set(currency, digits);
  }
  return digits;
}

export function intlLocale(locale: string): string {
  return locale === "ms" ? "ms-MY" : "en-MY";
}

export function formatMoney(minor: number, currency: string, locale = "en", opts: { signed?: boolean } = {}): string {
  const digits = currencyDigits(currency);
  const value = minor / 10 ** digits;
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: opts.signed ? "exceptZero" : "auto",
  }).format(value);
}

/** Plain number without currency symbol, for input fields. */
export function toInputValue(minor: number, currency: string): string {
  if (!minor) return "";
  const digits = currencyDigits(currency);
  return (minor / 10 ** digits).toFixed(digits);
}

/**
 * Parse user input like "12", "12.5", "1,234.50" into minor units without floating-point error.
 * Returns null for empty or invalid input.
 */
export function parseMoney(input: string, currency: string): number | null {
  const digits = currencyDigits(currency);
  const cleaned = input.replace(/[\s,]/g, "");
  if (cleaned === "") return null;
  const match = /^(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) return null;
  const [, whole = "", frac = ""] = match;
  if (whole === "" && frac === "") return null;
  if (frac.length > digits) return null;
  const minor = Number(whole || "0") * 10 ** digits + Number((frac + "0".repeat(digits)).slice(0, digits) || "0");
  return Number.isSafeInteger(minor) ? minor : null;
}
