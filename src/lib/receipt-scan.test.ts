import { describe, expect, it } from "vitest";
import { lineSplit, replyText, toScan } from "./receipt-scan";

const receipt = {
  readable: true,
  shop: "  Restoran   Ali ",
  currency: "MYR",
  lines: [
    { name: "Nasi lemak", qty: 2, amount: 24 },
    { name: "Teh ais", qty: 1, amount: 6 },
    { name: "Roti canai", amount: 10 },
  ],
  subtotal: 40,
  serviceRate: 10,
  service: 4,
  taxRate: 6,
  tax: 2.64,
  total: 46.65,
};

describe("toScan", () => {
  it("turns the reply into sen, keeping the receipt's exact total", () => {
    expect(toScan(receipt)).toEqual({
      ok: true,
      scan: {
        shop: "Restoran Ali",
        lines: [
          { name: "2 × Nasi lemak", amountMinor: 2400 },
          { name: "Teh ais", amountMinor: 600 },
          { name: "Roti canai", amountMinor: 1000 },
        ],
        subtotalMinor: 4000,
        serviceBp: 1000,
        taxBp: 600,
        totalMinor: 4665,
      },
    });
  });

  it("works out the rates from the amounts when no percent is printed", () => {
    const result = toScan({ ...receipt, serviceRate: undefined, taxRate: null });
    expect(result.ok && [result.scan.serviceBp, result.scan.taxBp]).toEqual([1000, 600]);
  });

  it("leaves out charges the receipt doesn't have", () => {
    const result = toScan({ ...receipt, serviceRate: null, service: null, taxRate: null, tax: null, total: 40 });
    expect(result.ok && result.scan).toMatchObject({ subtotalMinor: 4000, totalMinor: 4000 });
    expect(result.ok && "serviceBp" in result.scan).toBe(false);
  });

  it("uses the printed subtotal when there are no lines", () => {
    const result = toScan({ ...receipt, lines: [] });
    expect(result.ok && [result.scan.lines, result.scan.subtotalMinor]).toEqual([[], 4000]);
  });

  it("drops lines with no amount and ignores a rate that can't be right", () => {
    const result = toScan({ ...receipt, lines: [...receipt.lines, { name: "Free gift", amount: 0 }], taxRate: 60 });
    expect(result.ok && result.scan.lines).toHaveLength(3);
    expect(result.ok && result.scan.taxBp).toBe(600);
  });

  it("leaves out SST that is already inside the prices", () => {
    const result = toScan({
      ...receipt,
      serviceRate: null,
      service: null,
      taxRate: 6,
      tax: 3.7,
      subtotal: 40,
      total: 40,
    });
    expect(result.ok && result.scan).toMatchObject({ subtotalMinor: 4000, totalMinor: 4000 });
    expect(result.ok && "taxBp" in result.scan).toBe(false);
  });

  it("keeps the rates when the total doesn't match any of them", () => {
    const result = toScan({ ...receipt, total: 45 });
    expect(result.ok && [result.scan.serviceBp, result.scan.taxBp, result.scan.totalMinor]).toEqual([1000, 600, 4500]);
  });

  it("refuses other currencies", () => {
    expect(toScan({ ...receipt, currency: "SGD" })).toEqual({ ok: false, error: "currency" });
    expect(toScan({ ...receipt, currency: "rm" }).ok).toBe(true);
  });

  it("refuses a photo that isn't a readable receipt", () => {
    expect(toScan({ readable: false, lines: [] })).toEqual({ ok: false, error: "unreadable" });
    expect(toScan({ readable: true, lines: [] })).toEqual({ ok: false, error: "unreadable" });
    expect(toScan("not json")).toEqual({ ok: false, error: "unreadable" });
  });
});

describe("replyText", () => {
  it("reads the model's text from the reply", () => {
    const body = {
      status: "completed",
      steps: [
        { type: "thought", content: [{ type: "text", text: "hmm" }] },
        {
          type: "model_output",
          content: [
            { type: "text", text: '{"readable":' },
            { type: "text", text: "true}" },
          ],
        },
      ],
    };
    expect(replyText(body)).toBe('{"readable":true}');
  });

  it("gives nothing for a reply without text", () => {
    expect(replyText({ steps: [] })).toBeNull();
    expect(replyText(null)).toBeNull();
  });
});

describe("lineSplit", () => {
  const lines = [
    { name: "Nasi lemak", amountMinor: 2400, who: ["h"] },
    { name: "Teh ais", amountMinor: 600, who: ["n"] },
    { name: "Roti canai", amountMinor: 1000, who: [] },
  ];

  it("adds up what each person had, sharing blank lines between everyone", () => {
    expect(lineSplit(lines, ["h", "n", "a"])).toEqual({
      participants: ["h", "n", "a"],
      overrides: { h: 2734, n: 933, a: 333 },
    });
  });

  it("leaves out people who had nothing", () => {
    expect(lineSplit([lines[0], { ...lines[1], who: ["n", "h"] }], ["h", "n", "a"])).toEqual({
      participants: ["h", "n"],
      overrides: { h: 2700, n: 300 },
    });
  });

  it("is an equal split until someone is tapped", () => {
    expect(
      lineSplit(
        lines.map((l) => ({ ...l, who: [] })),
        ["h", "n"],
      ),
    ).toBeNull();
  });
});
