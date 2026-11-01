import { describe, expect, it } from "vitest";
import { payQrSchema } from "./bill-schema";
import { isPaymentQr, MAX_QR_LENGTH } from "./pay-qr";

const DUITNOW = "00020101021126410014A000000615000101065887340213012345678905204000053034585802MY6304ABCD";

describe("isPaymentQr", () => {
  it("accepts a bank or e-wallet code", () => {
    expect(isPaymentQr(DUITNOW)).toBe(true);
    expect(isPaymentQr(` ${DUITNOW} `)).toBe(true);
    expect(isPaymentQr("KANE-WALLET-7012")).toBe(true);
  });

  it("refuses anything that opens a website or an app", () => {
    for (const code of [
      "https://example.com/pay",
      "HTTP://EXAMPLE.COM",
      "www.example.com",
      "example.com",
      "bit.ly/abc",
      "mailto:a@b.co",
      "tel:0123456789",
      "javascript:alert(1)",
    ])
      expect(isPaymentQr(code), code).toBe(false);
  });

  it("refuses empty and oversized codes", () => {
    expect(isPaymentQr("  ")).toBe(false);
    expect(isPaymentQr(`000201${"1".repeat(MAX_QR_LENGTH)}`)).toBe(false);
  });

  it("is enforced by the server's schema, where null clears it", () => {
    expect(payQrSchema.safeParse(DUITNOW).success).toBe(true);
    expect(payQrSchema.safeParse(null).success).toBe(true);
    expect(payQrSchema.safeParse("https://example.com").success).toBe(false);
  });
});
