import { describe, expect, it } from "vitest";
import { receiptFileName } from "./share-sheet";

describe("receiptFileName", () => {
  it("uses the receipt's local date and time, then the link id", () => {
    const local = new Date(2026, 9, 6, 1, 48).toISOString();
    expect(receiptFileName(local, "GagYTBLfty")).toBe("Receipt_20261006-0148_GagYTBLfty.png");
  });

  it("leaves the id out before the bill has a link", () => {
    expect(receiptFileName(new Date(2026, 0, 2, 9, 5).toISOString(), null)).toBe("Receipt_20260102-0905.png");
  });
});
