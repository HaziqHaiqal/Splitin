import { z } from "zod";
import type { Item } from "./bill";
import { addCharges, splitByWeights, type Allocation, type Rates } from "./money";

export type ScanLine = { name: string; amountMinor: number; offMinor?: number };

export type Scan = {
  shop: string;
  lines: ScanLine[];
  subtotalMinor: number;
  serviceBp?: number;
  taxBp?: number;
  includedTaxBp?: number;
  taxLabel?: string;
  offMinor?: number;
  totalMinor: number;
};

export const SCAN_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type ScanError = "unreadable" | "currency" | "busy" | "limit" | "off" | "photo" | "failed" | "offline";

export const SCAN_PROMPT = [
  "You read photos of shop and restaurant receipts and reply with JSON only.",
  "Amounts are numbers in the receipt's currency, like 12.50.",
  "lines: each thing bought, in the order printed, with the line total (quantity times price) as printed. Leave out subtotal, service charge, tax, rounding, payment and change lines.",
  "Discounts come in many forms, like -4.00, (4.00), 4.00-, DISC, LESS, PROMO, VOUCHER, MEMBER, FREE or 20% OFF. When only a percent is printed, work out the amount it takes off.",
  "A discount on one item: its own line right after that item, with the amount as a negative number, like -4.00.",
  "discount: the total taken off the whole bill rather than one item, like a voucher or member discount, as a positive number.",
  "subtotal: the amount before service charge and tax, if printed.",
  "serviceRate and taxRate: the percent printed, like 10 or 6.",
  "service, serviceRate, tax and taxRate: only for charges added on top of the prices. Leave them out when the receipt says the prices already include them, like Inclusive Service Tax.",
  "includedTaxRate and includedTax: the percent and the tax amount when the receipt says the prices already include the tax, like 6 and 5.58 for Inclusive Service Tax 6% with Tax 5.58. Inclusive Service Tax, SST or GST in a Tax Summary is a tax, never a service charge.",
  "taxLines: every line that mentions tax, SST, GST or cukai, including a Tax Summary at the bottom, with its label as printed, the tax amount, the percent if printed, and inclusive true when it says the prices already include it.",
  "footer: every printed line after the last item that has a number on it, top to bottom, with its words as printed and its numbers. Include totals, payment and every row of a Tax Summary.",
  "total: the final amount to pay, after discounts and any rounding.",
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
    includedTaxRate: amount,
    includedTax: amount,
    taxLines: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, amount, rate: amount, inclusive: { type: "boolean" } },
        required: ["label", "amount"],
      },
    },
    footer: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, numbers: { type: "array", items: amount } },
        required: ["text"],
      },
    },
    discount: amount,
    total: amount,
  },
  required: ["readable", "lines", "footer"],
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
  includedTaxRate: num,
  includedTax: num,
  taxLines: z
    .array(z.object({ label: z.string(), amount: z.number().finite(), rate: num, inclusive: z.boolean().nullish() }))
    .max(10)
    .nullish(),
  footer: z
    .array(z.object({ text: z.string(), numbers: z.array(z.number().finite()).nullish() }))
    .max(60)
    .nullish(),
  discount: num,
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

function foldDiscounts(lines: ScanLine[]) {
  const items: ScanLine[] = [];
  let itemOff = 0;
  let spare = 0;
  for (const line of lines) {
    if (line.amountMinor < 0) {
      const last = items.at(-1);
      const off = Math.min(-line.amountMinor, last?.amountMinor ?? 0);
      if (last && off > 0) {
        last.amountMinor -= off;
        last.offMinor = (last.offMinor ?? 0) + off;
      }
      itemOff += off;
      spare += -line.amountMinor - off;
    } else if (line.name && line.amountMinor > 0) items.push({ ...line });
  }
  return { items: items.filter((line) => line.amountMinor > 0).slice(0, MAX_LINES), itemOff, spare };
}

const beforeCharges = (off: number, rates: Rates) =>
  Math.round((off * 100_000_000) / ((10_000 + (rates.serviceBp ?? 0)) * (10_000 + (rates.taxBp ?? 0))));

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

  const { items, itemOff, spare } = foldDiscounts(
    (r.lines ?? []).map((line) => {
      const name = line.name.trim().replace(/\s+/g, " ");
      const qty = line.qty && line.qty > 1 && Number.isInteger(line.qty) ? `${line.qty} × ` : "";
      return { name: `${qty}${name}`.slice(0, 60), amountMinor: toMinor(line.amount) };
    }),
  );
  const billOff = Math.abs(toMinor(r.discount)) + spare;
  const linesMinor = items.reduce((sum, line) => sum + line.amountMinor, 0);
  const printed = toMinor(r.subtotal);
  const service = toMinor(r.service);
  const total = toMinor(r.total);
  const printedTax = (r.footer ?? [])
    .filter((row) => !/total/i.test(row.text))
    .map((row) => ({
      label: row.text,
      amount: row.numbers?.at(-1) ?? 0,
      rate: Number(/(\d+(?:\.\d+)?)\s*%/.exec(row.text)?.[1]) || undefined,
      inclusive: undefined,
    }));
  const taxLine =
    r.tax || r.includedTax
      ? undefined
      : [...(r.taxLines ?? []), ...printedTax].find(
          (line) =>
            /tax|sst|gst|cukai/i.test(line.label) && line.amount > 0 && (total <= 0 || line.amount * 100 < total),
        );
  const lineInside = Boolean(
    taxLine &&
    (taxLine.inclusive || /incl/i.test(taxLine.label) || (total > 0 && Math.abs(total - linesMinor + billOff) <= 10)),
  );
  const named = [...(r.taxLines ?? []), ...printedTax].find(
    (line) => /tax|sst|gst|cukai/i.test(line.label) && line.amount > 0,
  )?.label;
  const taxLabel = (named ?? "")
    .replace(/@?\s*\d+(?:\.\d+)?\s*%/g, " ")
    .replace(/\d+(?:[.,]\d+)?/g, " ")
    .replace(/[([]\s*[)\]]/g, "")
    .replace(/\s+([)\]])/g, "$1")
    .replace(/[\s:@-]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  const tax = toMinor(r.tax) || (taxLine && !lineInside ? toMinor(taxLine.amount) : 0);
  const taxRate = r.taxRate ?? (taxLine && !lineInside ? taxLine.rate : undefined);
  const includedTax = toMinor(r.includedTax) || (taxLine && lineInside ? toMinor(taxLine.amount) : 0);
  const includedTaxRate = r.includedTaxRate ?? (taxLine && lineInside ? taxLine.rate : undefined);
  const base = Math.max(0, (printed > 0 ? printed : linesMinor) - billOff);
  const read: Rates = {
    serviceBp: rateBp(r.serviceRate, service, base),
    taxBp: rateBp(taxRate, tax, base + service),
  };
  const gross = linesMinor > 0 ? linesMinor : printed;
  const subtotalOf = (off: number) => (gross > 0 ? gross - off : total);
  const choices = [read, { serviceBp: read.serviceBp }, { taxBp: read.taxBp }, {}].flatMap((rates) =>
    (billOff > 0 && gross > 0 ? [billOff, beforeCharges(billOff, rates)] : [0]).map((off) => ({ rates, off })),
  );
  const fits = ({ rates, off }: { rates: Rates; off: number }) =>
    Math.abs(addCharges(subtotalOf(off), rates).total - total) <= 10;
  const chosen = (total > 0 ? choices.find(fits) : undefined) ?? { rates: read, off: gross > 0 ? billOff : 0 };
  const { serviceBp, taxBp } = chosen.rates;
  const subtotalMinor = subtotalOf(chosen.off);
  const shares =
    chosen.off > 0 && chosen.off < linesMinor
      ? splitByWeights(chosen.off, Object.fromEntries(items.map((line, i) => [i, line.amountMinor])))
      : {};
  const charged = items
    .map((line, i) => ({ ...line, amountMinor: line.amountMinor - (shares[i] ?? 0) }))
    .filter((line) => line.amountMinor > 0);
  const totalMinor = total > 0 ? total : addCharges(subtotalMinor, read).total;
  const fromService =
    !serviceBp && !taxBp && !tax && service > 0 ? rateBp(r.serviceRate, service, subtotalMinor - service) : undefined;
  const inService =
    fromService && Math.abs(service - Math.round((subtotalMinor * fromService) / (10_000 + fromService))) <= 2
      ? fromService
      : undefined;
  const inPrinted = includedTax || (inService ? service : 0);
  const includedTaxBp = taxBp
    ? undefined
    : (rateBp(includedTaxRate, inPrinted, totalMinor - inPrinted) ?? inService ?? read.taxBp);
  const inTax = inPrinted || tax;
  const exact = includedTaxBp ? Math.round((subtotalMinor * includedTaxBp) / (10_000 + includedTaxBp)) : 0;
  const inside = includedTaxBp && !serviceBp ? (Math.abs(inTax - exact) <= 2 ? inTax : exact) : 0;
  const before = subtotalMinor - inside;
  const pre =
    inside > 0 ? splitByWeights(before, Object.fromEntries(charged.map((line, i) => [i, line.amountMinor]))) : {};
  const lines =
    inside > 0
      ? charged
          .map(({ offMinor, ...line }, i) => ({
            ...line,
            amountMinor: pre[i] ?? 0,
            ...(offMinor ? { offMinor: Math.round((offMinor * before) / subtotalMinor) } : {}),
          }))
          .filter((line) => line.amountMinor > 0)
      : charged;
  const offMinor = itemOff + billOff;
  if (subtotalMinor <= 0 || totalMinor <= 0 || totalMinor > MAX_MINOR || subtotalMinor > MAX_MINOR)
    return { ok: false, error: "unreadable" };

  return {
    ok: true,
    scan: {
      shop: (r.shop ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
      lines,
      subtotalMinor: before,
      ...(serviceBp ? { serviceBp } : {}),
      ...(taxBp || inside ? { taxBp: taxBp || includedTaxBp } : {}),
      ...((taxBp || inside) && taxLabel ? { taxLabel } : {}),
      ...(includedTaxBp && !inside ? { includedTaxBp } : {}),
      ...(offMinor > 0 ? { offMinor } : {}),
      totalMinor,
    },
  };
}

export function lineSplit(
  lines: readonly (ScanLine & { who: readonly string[] })[],
  sharers: readonly string[],
  everyone: readonly string[] = sharers,
): { participants: string[]; overrides: Allocation } {
  const groups = lines
    .filter((line) => line.amountMinor > 0)
    .map((line) => ({ amount: line.amountMinor, owners: line.who.length > 0 ? line.who : sharers }));
  const total = groups.reduce((sum, group) => sum + group.amount, 0);
  if (!lines.some((line) => line.who.length > 0) || sharers.length === 0 || total <= 0)
    return { participants: [...sharers], overrides: {} };
  const [first] = groups;
  if (groups.every((g) => g.owners.length === first.owners.length && g.owners.every((id) => first.owners.includes(id))))
    return { participants: everyone.filter((id) => first.owners.includes(id)), overrides: {} };
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const unit = groups.reduce((lcm, group) => (lcm / gcd(lcm, group.owners.length)) * group.owners.length, 1);
  const weights: Allocation = Object.fromEntries(everyone.map((id) => [id, 0]));
  for (const group of groups)
    for (const id of group.owners) weights[id] = (weights[id] ?? 0) + group.amount * (unit / group.owners.length);
  const shares = splitByWeights(total, weights);
  const participants = Object.keys(weights).filter((id) => (shares[id] ?? 0) > 0);
  return { participants, overrides: Object.fromEntries(participants.map((id) => [id, shares[id]])) };
}

export function linesMatch(item: Pick<Item, "lines" | "participants" | "overrides">, everyone: readonly string[]) {
  if (!item.lines?.length) return false;
  const { participants, overrides } = lineSplit(item.lines, item.participants, everyone);
  const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id) => b.includes(id));
  return (
    same(participants, item.participants) &&
    same(Object.keys(overrides), Object.keys(item.overrides)) &&
    Object.entries(overrides).every(([id, amount]) => item.overrides[id] === amount)
  );
}
