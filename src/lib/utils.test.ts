import { describe, expect, it } from "vitest";
import { codeFromInput } from "./utils";

describe("codeFromInput", () => {
  it.each([
    ["K7QM3XPH", "K7QM3XPH"],
    [" k7qm-3xph ", "k7qm3xph"],
    ["K7QM 3XPH", "K7QM3XPH"],
    ["https://www.splitin.me/bill/K7QM3XPH", "K7QM3XPH"],
    ["https://www.splitin.me/bill/K7QM3XPH/?from=wa", "K7QM3XPH"],
    ["Trip (code K7QM3XPH). Tap to see: https://www.splitin.me/bill/K7QM3XPH", "K7QM3XPH"],
    ["", ""],
  ])("reads %j as %j", (input, code) => {
    expect(codeFromInput(input)).toBe(code);
  });

  it("keeps an owner link's secret out of the code", () => {
    expect(codeFromInput("https://www.splitin.me/bill/K7QM3XPH#owner=secret")).toBe("K7QM3XPH");
  });
});
