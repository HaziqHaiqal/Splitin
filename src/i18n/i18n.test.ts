import { describe, expect, it } from "vitest";
import { en } from "./en";
import { fmt, getDictionary, isLocale, type Locale } from "./index";

const locales: Locale[] = ["ms", "zh", "ta"];

function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  const english = new Map(strings(en));

  for (const locale of locales) {
    it(`${locale} has every line, with the same {names} as English`, () => {
      const lines = strings(getDictionary(locale));
      expect(lines.map(([path]) => path).sort()).toEqual([...english.keys()].sort());
      for (const [path, text] of lines) {
        expect(text.trim(), path).not.toBe("");
        expect(placeholders(text), path).toEqual(placeholders(english.get(path)!));
      }
    });
  }

  it("only accepts real languages", () => {
    expect(["en", "ms", "zh", "ta"].every(isLocale)).toBe(true);
    expect(["fr", "constructor", "toString", "", null].some(isLocale)).toBe(false);
  });

  it("fills in names and amounts", () => {
    expect(fmt(getDictionary("zh").bill.paidBy, { name: "Haziq" })).toBe("Haziq 付款");
  });
});
