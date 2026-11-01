import { QR_BANKS } from "./qr-banks";

export const MAX_QR_LENGTH = 512;

const DUITNOW_ID = "A0000006150001";
const NOT_A_NAME = new Set(["bin", "binti", "bt", "bte", "al", "ap"]);

type QrField = { tag: string; value: string };

function readFields(text: string): QrField[] | null {
  const fields: QrField[] = [];
  let at = 0;
  while (at < text.length) {
    const tag = text.slice(at, at + 2);
    const size = text.slice(at + 2, at + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(size)) return null;
    const value = text.slice(at + 4, at + 4 + Number(size));
    if (value.length < Number(size)) return null;
    fields.push({ tag, value });
    at += 4 + Number(size);
  }
  return fields;
}

function checksum(text: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function isPaymentQr(text: string) {
  const code = text.trim();
  if (!code || code.length > MAX_QR_LENGTH) return false;
  const fields = readFields(code);
  const last = fields?.at(-1);
  if (!fields || fields[0].tag !== "00" || last?.tag !== "63" || last.value.length !== 4) return false;
  return checksum(code.slice(0, -4)) === last.value.toUpperCase();
}

export function readQrDetails(code: string) {
  const fields = readFields(code.trim()) ?? [];
  const accounts = fields
    .filter(({ tag }) => Number(tag) >= 26 && Number(tag) <= 51)
    .map(({ value }) => readFields(value) ?? []);
  const duitNow = accounts.find((account) => account.some((f) => f.tag === "00" && f.value === DUITNOW_ID));
  const acquirer = duitNow?.find((f) => f.tag === "01")?.value;
  return {
    name: fields.find((f) => f.tag === "59")?.value.trim() || null,
    bank: (acquirer && QR_BANKS[acquirer]) || null,
    duitNow: Boolean(duitNow),
  };
}

const nameWords = (name: string) =>
  (name.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((word) => !NOT_A_NAME.has(word));

export function nameFitsQr(name: string, qrName: string | null) {
  const ours = nameWords(name).filter((word) => word.length >= 2);
  if (!qrName || ours.length === 0) return true;
  const theirs = nameWords(qrName);
  return ours.some((word) =>
    theirs.some((their) => their.includes(word) || (their.length >= 3 && word.includes(their))),
  );
}
