import { z } from "zod";
import { addCharges, splitEqual, type Allocation } from "./money";

export type ScanLine = { name: string; amountMinor: number };

export type Scan = {
  shop: string;
  lines: ScanLine[];
  subtotalMinor: number;
  serviceBp?: number;
  taxBp?: number;
  totalMinor: number;
};

export const SCAN_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type ScanError = "unreadable" | "currency" | "busy" | "limit" | "off" | "photo" | "failed";

export const SCAN_PROMPT = [
  "You read photos of shop and restaurant receipts and reply with JSON only.",
  "Amounts are numbers in the receipt's currency, like 12.50.",
  "lines: each thing bought, with the line total (quantity times price) as printed. Leave out subtotal, service charge, tax, rounding, discount, payment and change lines.",
  "subtotal: the amount before service charge and tax, if printed.",
  "serviceRate and taxRate: the percent printed, like 10 or 6.",
  "service and tax: the service charge and SST or tax added on top. Leave tax out when it is already included in the prices.",
  "total: the final amount to pay, after any rounding.",
  "currency: the ISO 4217 code, MYR for RM.",
  "shop: the shop or restaurant name.",
  "readable: false when the photo isn't a receipt or can't be read.",
].join("\n");

const amount = { type: "number" };

export const SCAN_SCHEMA = {
  type: "object",
  properties: {
    readable: { type: "boolean" },
    shop: { type: "string" },
    currency: { type: "string" },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, qty: amount, amount },
        required: ["name", "amount"],
      },
    },
    subtotal: amount,
    serviceRate: amount,
    service: amount,
    taxRate: amount,
    tax: amount,
    total: amount,
  },
  required: ["readable", "lines"],
};

const num = z.number().finite().nullish();

const replySchema = z.object({
  readable: z.boolean(),
  shop: z.string().nullish(),
  currency: z.string().nullish(),
  lines: z
    .array(z.object({ name: z.string(), qty: num, amount: z.number().finite() }))
    .max(200)
    .nullish(),
  subtotal: num,
  serviceRate: num,
  service: num,
  taxRate: num,
  tax: num,
  total: num,
});

const MAX_MINOR = 100_000_000_00;
const MAX_LINES = 60;
const MAX_RATE = 3000;

const toMinor = (value: number | null | undefined) =>
  value === null || value === undefined ? 0 : Math.round(value * 100);

function rateBp(printed: number | null | undefined, added: number, base: number): number | undefined {
  const bp = [printed ? Math.round(printed * 100) : 0, base > 0 ? Math.round((added * 10_000) / base) : 0].find(
    (v) => v > 0 && v <= MAX_RATE,
  );
  if (!bp) return undefined;
  const whole = Math.round(bp / 100) * 100;
  return Math.abs(bp - whole) <= 15 ? whole : bp;
}

export function replyText(body: unknown): string | null {
  const steps = (body as { steps?: unknown })?.steps;
  if (!Array.isArray(steps)) return null;
  const texts = steps
    .filter((step) => step?.type === "model_output" && Array.isArray(step.content))
    .flatMap((step) => step.content)
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string);
  return texts.length > 0 ? texts.join("") : null;
}

export function toScan(reply: unknown): { ok: true; scan: Scan } | { ok: false; error: ScanError } {
  const parsed = replySchema.safeParse(reply);
  if (!parsed.success || !parsed.data.readable) return { ok: false, error: "unreadable" };
  const r = parsed.data;
  const currency = r.currency?.trim().toUpperCase();
  if (currency && currency !== "MYR" && currency !== "RM") return { ok: false, error: "currency" };

  const lines = (r.lines ?? [])
    .map((line) => {
      const name = line.name.trim().replace(/\s+/g, " ");
      const qty = line.qty && line.qty > 1 && Number.isInteger(line.qty) ? `${line.qty} × ` : "";
      return { name: `${qty}${name}`.slice(0, 60), amountMinor: toMinor(line.amount) };
    })
    .filter((line) => line.name && line.amountMinor > 0)
    .slice(0, MAX_LINES);
  const linesMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);
  const printed = toMinor(r.subtotal);
  const service = toMinor(r.service);
  const tax = toMinor(r.tax);
  const base = printed > 0 ? printed : linesMinor;
  const serviceBp = rateBp(r.serviceRate, service, base);
  const taxBp = rateBp(r.taxRate, tax, base + service);
  const subtotalMinor = linesMinor > 0 ? linesMinor : printed > 0 ? printed : toMinor(r.total);
  const total = toMinor(r.total);
  const totalMinor = total > 0 ? total : addCharges(subtotalMinor, { serviceBp, taxBp }).total;
  if (subtotalMinor <= 0 || totalMinor <= 0 || totalMinor > MAX_MINOR || subtotalMinor > MAX_MINOR)
    return { ok: false, error: "unreadable" };

  return {
    ok: true,
    scan: {
      shop: (r.shop ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
      lines,
      subtotalMinor,
      ...(serviceBp ? { serviceBp } : {}),
      ...(taxBp ? { taxBp } : {}),
      totalMinor,
    },
  };
}

export function lineSplit(
  lines: readonly (ScanLine & { who: readonly string[] })[],
  everyone: readonly string[],
): { participants: string[]; overrides: Allocation } | null {
  if (!lines.some((line) => line.who.length > 0) || everyone.length === 0) return null;
  const totals: Allocation = {};
  for (const line of lines) {
    if (line.amountMinor <= 0) continue;
    for (const [id, part] of Object.entries(splitEqual(line.amountMinor, line.who.length > 0 ? line.who : everyone)))
      totals[id] = (totals[id] ?? 0) + part;
  }
  const participants = everyone.filter((id) => (totals[id] ?? 0) > 0);
  return { participants, overrides: Object.fromEntries(participants.map((id) => [id, totals[id]])) };
}
