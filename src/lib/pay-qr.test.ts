import { describe, expect, it } from "vitest";
import { payQrSchema } from "./bill-schema";
import { isPaymentQr, MAX_QR_LENGTH, nameFitsQr, readQrDetails } from "./pay-qr";

const AIMAN =
  "00020201021126520014A000000615000101065887340220000000000012345678905204000053034585802MY5913AIMAN BIN ALI6002KL63042103";
const AMIR =
  "00020201021126520014A000000615000101068900530220000000000012345678905204000053034585802MY5917AMIR BIN ZULKIFLI6002KL63046AFF";
const UNKNOWN_BANK =
  "00020201021126520014A000000615000101069999990220000000000012345678905204000053034585802MY5912HAZIQ HAIQAL6002KL6304F28B";

describe("isPaymentQr", () => {
  it("accepts a properly formed code, whichever version it starts with", () => {
    expect(isPaymentQr(AIMAN)).toBe(true);
    expect(isPaymentQr(` ${AIMAN} `)).toBe(true);
    expect(isPaymentQr(AMIR.replace(/6AFF$/, "6aff"))).toBe(true);
  });

  it("refuses a code whose contents were changed", () => {
    expect(isPaymentQr(AIMAN.replace("AIMAN", "AMIRA"))).toBe(false);
    expect(isPaymentQr(AIMAN.replace(/2103$/, "2104"))).toBe(false);
  });

  it("refuses anything that isn't a payment code", () => {
    for (const code of [
      "https://example.com/pay",
      "HTTP://EXAMPLE.COM",
      "www.example.com",
      "example.com",
      "bit.ly/abc",
      "mailto:a@b.co",
      "tel:0123456789",
      "javascript:alert(1)",
      "KANE-WALLET-7012",
      "000201https://example.com",
      "000201QR",
      "6304ABCD",
    ])
      expect(isPaymentQr(code), code).toBe(false);
  });

  it("refuses empty and oversized codes", () => {
    expect(isPaymentQr("  ")).toBe(false);
    expect(isPaymentQr(`000201${"1".repeat(MAX_QR_LENGTH)}`)).toBe(false);
  });

  it("is enforced by the server's schema, where null clears it", () => {
    expect(payQrSchema.safeParse(AIMAN).success).toBe(true);
    expect(payQrSchema.safeParse(null).success).toBe(true);
    expect(payQrSchema.safeParse("https://example.com").success).toBe(false);
  });
});

describe("readQrDetails", () => {
  it("reads the name, the bank or e-wallet and DuitNow from the code", () => {
    expect(readQrDetails(AIMAN)).toEqual({ name: "AIMAN BIN ALI", bank: "Maybank", duitNow: true });
    expect(readQrDetails(AMIR)).toEqual({ name: "AMIR BIN ZULKIFLI", bank: "TNG eWallet", duitNow: true });
  });

  it("shows no bank for a code that isn't on PayNet's list", () => {
    expect(readQrDetails(UNKNOWN_BANK)).toEqual({ name: "HAZIQ HAIQAL", bank: null, duitNow: true });
  });

  it("copes with a code it can't read", () => {
    expect(readQrDetails("not a code")).toEqual({ name: null, bank: null, duitNow: false });
  });
});

describe("nameFitsQr", () => {
  it("is happy when any part of the names is related", () => {
    expect(nameFitsQr("Hana", "HANA BINTI AHMAD")).toBe(true);
    expect(nameFitsQr("hana ahmad", "HANA BINTI AHMAD")).toBe(true);
    expect(nameFitsQr("Ahmad", "HANA BINTI AHMAD")).toBe(true);
    expect(nameFitsQr("Zul", "AMIR BIN ZULKIFLI")).toBe(true);
    expect(nameFitsQr("Hanabi", "HANA BINTI AHMAD")).toBe(true);
  });

  it("speaks up when nothing is related", () => {
    expect(nameFitsQr("Hana", "AMIR BIN ZULKIFLI")).toBe(false);
    expect(nameFitsQr("Kak Long", "NUR AZLINA")).toBe(false);
  });

  it("doesn't match on words like bin and binti", () => {
    expect(nameFitsQr("Robin", "AMIR BIN ZULKIFLI")).toBe(false);
    expect(nameFitsQr("Ali bin Abu", "SITI BINTI OMAR")).toBe(false);
  });

  it("says nothing when there is no name to compare", () => {
    expect(nameFitsQr("Hana", null)).toBe(true);
    expect(nameFitsQr("A", "AMIR BIN ZULKIFLI")).toBe(true);
  });
});
