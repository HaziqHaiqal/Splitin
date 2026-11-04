"use server";

import { createHmac, randomBytes, randomInt, randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { isLocale, LOCALE_COOKIE } from "@/i18n";
import {
  joinItem,
  joinShare,
  leaveItem,
  canSetDetails,
  hasPayDetails,
  mergeMemberChanges,
  ownerDetailsWin,
  repeatedName,
  splitItem,
  summarize,
  withItem,
  withNewPeople,
  withoutOwnItem,
  type BillDoc,
  type BillRights,
  type Item,
  type Person,
} from "@/lib/bill";
import { eventRows, saveArgs } from "@/lib/bill-rows";
import {
  bankSchema,
  billDocSchema,
  itemSchema,
  MAX_ITEMS,
  MAX_PEOPLE,
  payQrSchema,
  personNameSchema,
} from "@/lib/bill-schema";
import { browserHash, ensureBrowserHash, hashToken } from "@/lib/browser-key";
import { getBill, linkExpired, readBill } from "@/lib/data/bill";
import { createdEvent, diffDocs, memberWho, ownerWho, personName, type EventBody, type Who } from "@/lib/history";
import { broadcastChange } from "@/lib/realtime-server";
import { db } from "@/lib/supabase/server";
import { CODE_LENGTH } from "@/lib/utils";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const BILLS_PER_HOUR = 30;
const MEMBER_CHANGES_PER_HOUR = 100;
const WRITE_ATTEMPTS = 5;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomId(length: number) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

const newCode = () =>
  Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

async function guard<T>(run: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await run();
  } catch (error) {
    console.error("[splitin] action failed:", error);
    return { ok: false, error: "server" };
  }
}

function changed(id: string) {
  after(() => broadcastChange(id));
  refresh();
}

const tokenMatches = (hash: string, token: unknown) =>
  typeof token === "string" && token.length >= 16 && hash === hashToken(token);

async function isOwner(id: string, token: unknown): Promise<boolean> {
  const { data } = await db().from("bills").select("owner_token_hash, browser_hash").eq("id", id).maybeSingle();
  if (!data) return false;
  if (tokenMatches(data.owner_token_hash, token)) return true;
  const browser = await browserHash();
  return Boolean(browser && data.browser_hash === browser);
}

async function tooManyChanges(id: string): Promise<boolean> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error } = await db()
    .from("bill_events")
    .select("id", { count: "exact", head: true })
    .eq("bill_id", id)
    .eq("by_role", "member")
    .gte("created_at", since);
  return !error && (count ?? 0) >= MEMBER_CHANGES_PER_HOUR;
}

function signingKey() {
  const key = process.env.BILL_SIGNING_SECRET;
  if (!key) throw new Error("BILL_SIGNING_SECRET is not set");
  return key;
}

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  refresh();
}

export async function publishBill(input: BillDoc): Promise<Result<{ id: string; ownerToken: string }>> {
  return guard(async () => {
    const parsed = billDocSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid" };
    const doc = parsed.data as BillDoc;
    if (repeatedName(doc)) return { ok: false, error: "duplicate" };

    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
    const ipHash = createHmac("sha256", signingKey()).update(ip).digest("hex").slice(0, 32);
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await db()
      .from("bills")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if ((count ?? 0) >= BILLS_PER_HOUR) return { ok: false, error: "rate_limited" };

    const ownerToken = randomId(32);
    const { p_bill, ...rows } = saveArgs(doc, {});
    const bill = {
      ...p_bill,
      owner_token_hash: hashToken(ownerToken),
      browser_hash: await ensureBrowserHash(),
      ip_hash: ipHash,
      started_at: doc.createdAt,
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = newCode();
      const { error } = await db().rpc("create_bill", {
        p_id: id,
        p_bill: bill,
        ...rows,
        p_events: eventRows(ownerWho(doc), [createdEvent(doc)]),
      });
      if (!error) return { ok: true, data: { id, ownerToken } };
      if (error.code !== "23505") {
        console.error("[splitin] create failed:", error);
        return { ok: false, error: "db" };
      }
    }
    return { ok: false, error: "db" };
  });
}

export async function findBill(code: string): Promise<Result<{ id: string }>> {
  return guard(async () => {
    const id = code.toUpperCase();
    if (await getBill(id)) return { ok: true, data: { id } };
    return { ok: false, error: (await linkExpired(id)) ? "expired" : "not_found" };
  });
}

type Change = { doc: BillDoc; who: Who; events: EventBody[] };

async function writeBill(
  id: string,
  change: (doc: BillDoc, rights: BillRights) => Change | null,
): Promise<BillDoc | null> {
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
    const bill = await readBill(id);
    if (!bill) return null;
    const next = change(bill.doc, bill.rights);
    if (!next) return null;
    const { data, error } = await db().rpc("save_bill", {
      p_id: id,
      p_version: bill.version,
      ...saveArgs(next.doc, bill.rights),
      p_events: eventRows(next.who, next.events),
    });
    if (error) {
      console.error("[splitin] save failed:", error);
      return null;
    }
    if (data !== null) return next.doc;
  }
  return null;
}

async function writeOwnerDoc(
  id: string,
  ownerToken: string | null,
  input: BillDoc,
  seenAt: string,
): Promise<Result<{ doc: BillDoc }>> {
  const parsed = billDocSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (!(await isOwner(id, ownerToken))) return { ok: false, error: "forbidden" };
  const { data: paid, error } = await db().from("payments").select("from_person, to_person").eq("bill_id", id);
  if (error) return { ok: false, error: "db" };
  let refused = "db";
  const saved = await writeBill(id, (current, rights) => {
    const merged = mergeMemberChanges(current, parsed.data as BillDoc, seenAt);
    if (repeatedName(merged)) {
      refused = "duplicate";
      return null;
    }
    const gone = new Set(current.people.filter((p) => !merged.people.some((q) => q.id === p.id)).map((p) => p.id));
    if (paid.some((p) => gone.has(p.from_person) || gone.has(p.to_person))) {
      refused = "has_payment";
      return null;
    }
    const { doc, people } = ownerDetailsWin(current, merged, rights);
    rights.people = people;
    return { doc, who: ownerWho(doc), events: diffDocs(current, doc) };
  });
  return saved ? { ok: true, data: { doc: saved } } : { ok: false, error: refused };
}

export async function saveOwnerEdit(
  id: string,
  ownerToken: string | null,
  input: BillDoc,
  seenAt: string,
): Promise<Result<{ doc: BillDoc }>> {
  return guard(async () => {
    const result = await writeOwnerDoc(id, ownerToken, input, seenAt);
    if (result.ok) changed(id);
    return result;
  });
}

const newPeopleSchema = z.array(z.object({ id: z.string().min(1).max(40), name: personNameSchema })).max(10);

export async function addMemberItem(
  id: string,
  input: Item,
  byId?: unknown,
  newPeople: unknown = [],
): Promise<Result<{ id: string }>> {
  return guard(async () => {
    const parsed = itemSchema.safeParse(input);
    const added = newPeopleSchema.safeParse(newPeople);
    if (!parsed.success || !added.success) return { ok: false, error: "invalid" };
    if (await tooManyChanges(id)) return { ok: false, error: "rate_limited" };
    const browser = await ensureBrowserHash();
    const { name, amountMinor, paidBy, participants, overrides } = parsed.data;
    const item: Item = { id: randomId(8), name, amountMinor, paidBy, participants, overrides };
    let refused = "invalid";
    const saved = await writeBill(id, (current, rights) => {
      if (current.locked) {
        refused = "locked";
        return null;
      }
      const at = new Date().toISOString();
      const doc = withNewPeople(current, added.data, at);
      if (!doc) {
        refused = "duplicate";
        return null;
      }
      const people = new Set(doc.people.map((p) => p.id));
      const known = people.has(item.paidBy) && item.participants.every((p) => people.has(p));
      const fits = splitItem(item.amountMinor, item.participants, item.overrides).ok;
      if (!known || !fits || doc.items.length >= MAX_ITEMS || doc.people.length > MAX_PEOPLE) return null;
      rights.items = { ...rights.items, [item.id]: browser };
      rights.people = { ...rights.people, ...Object.fromEntries(added.data.map((p) => [p.id, browser])) };
      return {
        doc: { ...doc, items: [...doc.items, { ...item, addedAt: at }] },
        who: memberWho(doc, byId),
        events: [
          ...added.data.map((p): EventBody => ({ kind: "person_added", name: p.name })),
          { kind: "item_added", name: item.name, amountMinor: item.amountMinor, payer: personName(doc, item.paidBy) },
        ],
      };
    });
    if (!saved) return { ok: false, error: refused };
    changed(id);
    return { ok: true, data: { id: item.id } };
  });
}

export async function removeMemberItem(id: string, itemId: string, byId?: unknown): Promise<Result> {
  return guard(async () => {
    if (await tooManyChanges(id)) return { ok: false, error: "rate_limited" };
    const browser = await browserHash();
    if (!browser) return { ok: false, error: "forbidden" };
    let refused = "forbidden";
    const saved = await writeBill(id, (doc, rights) => {
      if (doc.locked) {
        refused = "locked";
        return null;
      }
      const next = withoutOwnItem(doc, rights, itemId, browser);
      const item = doc.items.find((i) => i.id === itemId);
      if (!next || !item) return null;
      return {
        doc: next,
        who: memberWho(doc, byId),
        events: [{ kind: "item_deleted", name: item.name, amountMinor: item.amountMinor }],
      };
    });
    if (!saved) return { ok: false, error: refused };
    changed(id);
    return { ok: true, data: null };
  });
}

export async function editMemberItem(
  id: string,
  input: Item,
  byId?: unknown,
  newPeople: unknown = [],
): Promise<Result> {
  return guard(async () => {
    const parsed = itemSchema.safeParse(input);
    const added = newPeopleSchema.safeParse(newPeople);
    if (!parsed.success || !added.success) return { ok: false, error: "invalid" };
    if (await tooManyChanges(id)) return { ok: false, error: "rate_limited" };
    const browser = await browserHash();
    if (!browser) return { ok: false, error: "forbidden" };
    let refused = "forbidden";
    const saved = await writeBill(id, (current, rights) => {
      if (current.locked) {
        refused = "locked";
        return null;
      }
      const old = current.items.find((i) => i.id === parsed.data.id);
      if (!old?.addedAt || rights.items?.[old.id] !== browser) return null;
      refused = "invalid";
      const doc = withNewPeople(current, added.data, new Date().toISOString());
      if (!doc) {
        refused = "duplicate";
        return null;
      }
      const { name, amountMinor, paidBy, participants, overrides } = parsed.data;
      const joins = Object.fromEntries(Object.entries(old.joins ?? {}).filter(([p]) => participants.includes(p)));
      const item: Item = {
        id: old.id,
        name,
        amountMinor,
        paidBy,
        participants,
        overrides,
        addedAt: old.addedAt,
        ...(Object.keys(joins).length > 0 ? { joins } : {}),
      };
      const people = new Set(doc.people.map((p) => p.id));
      const known = people.has(item.paidBy) && item.participants.every((p) => people.has(p));
      const fits = splitItem(item.amountMinor, item.participants, item.overrides).ok;
      if (!known || !fits || doc.people.length > MAX_PEOPLE) return null;
      const next = withItem(doc, item);
      const events: EventBody[] = [
        ...added.data.map((p): EventBody => ({ kind: "person_added", name: p.name })),
        ...diffDocs(doc, next),
      ];
      if (events.length === 0) {
        refused = "unchanged";
        return null;
      }
      rights.people = { ...rights.people, ...Object.fromEntries(added.data.map((p) => [p.id, browser])) };
      return { doc: next, who: memberWho(doc, byId), events };
    });
    if (refused === "unchanged") return { ok: true, data: null };
    if (!saved) return { ok: false, error: refused };
    changed(id);
    return { ok: true, data: null };
  });
}

export async function renameMe(id: string, personId: unknown, input: unknown): Promise<Result> {
  return guard(async () => {
    const parsed = personNameSchema.safeParse(input);
    if (!parsed.success || typeof personId !== "string") return { ok: false, error: "invalid" };
    if (await tooManyChanges(id)) return { ok: false, error: "rate_limited" };
    const name = parsed.data;
    let refused = "forbidden";
    const saved = await writeBill(id, (doc) => {
      if (doc.locked) {
        refused = "locked";
        return null;
      }
      const person = doc.people.find((p) => p.id === personId);
      if (!person || person.id === doc.ownerId) return null;
      if (person.name === name) {
        refused = "unchanged";
        return null;
      }
      if (doc.people.some((p) => p.id !== person.id && p.name.toLowerCase() === name.toLowerCase())) {
        refused = "duplicate";
        return null;
      }
      return {
        doc: { ...doc, people: doc.people.map((p) => (p.id === person.id ? { ...p, name } : p)) },
        who: memberWho(doc, person.id),
        events: [{ kind: "person_renamed", from: person.name, to: name }],
      };
    });
    if (refused === "unchanged") return { ok: true, data: null };
    if (!saved) return { ok: false, error: refused };
    changed(id);
    return { ok: true, data: null };
  });
}

export async function addMyName(id: string, input: unknown): Promise<Result<{ person: Person }>> {
  return guard(async () => {
    const parsed = personNameSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid" };
    if (await tooManyChanges(id)) return { ok: false, error: "rate_limited" };
    const browser = await ensureBrowserHash();
    const personId = randomId(6);
    let person: Person | undefined;
    let refused = "invalid";
    const saved = await writeBill(id, (current, rights) => {
      if (current.locked) {
        refused = "locked";
        return null;
      }
      const owner = current.people.find((p) => p.id === current.ownerId);
      if (owner && owner.name.toLowerCase() === parsed.data.toLowerCase()) {
        refused = "owner_name";
        return null;
      }
      const doc = withNewPeople(current, [{ id: personId, name: parsed.data }], new Date().toISOString());
      if (!doc) {
        refused = "duplicate";
        return null;
      }
      if (doc.people.length > MAX_PEOPLE) return null;
      const added = doc.people[doc.people.length - 1];
      person = added;
      rights.people = { ...rights.people, [personId]: browser };
      return {
        doc,
        who: { role: "member", personId: added.id, name: added.name },
        events: [{ kind: "person_joined", name: added.name }],
      };
    });
    if (!saved || !person) return { ok: false, error: refused };
    changed(id);
    return { ok: true, data: { person } };
  });
}

const myBillsSchema = z.object({
  join: z.array(z.object({ itemId: z.string(), written: z.int().min(1).optional() })).max(MAX_ITEMS),
  change: z.array(z.object({ itemId: z.string(), written: z.int().min(1).optional() })).max(MAX_ITEMS),
  leave: z.array(z.object({ itemId: z.string() })).max(MAX_ITEMS),
});

export type MyBillChanges = z.infer<typeof myBillsSchema>;

export async function saveMyBills(id: string, byId: unknown, input: MyBillChanges): Promise<Result> {
  return guard(async () => {
    const parsed = myBillsSchema.safeParse(input);
    if (!parsed.success || typeof byId !== "string") return { ok: false, error: "invalid" };
    if (await tooManyChanges(id)) return { ok: false, error: "rate_limited" };
    const { join, change, leave } = parsed.data;
    const browser = await ensureBrowserHash();
    let refused = "invalid";
    const saved = await writeBill(id, (doc, rights) => {
      if (doc.locked) {
        refused = "locked";
        return null;
      }
      const who = memberWho(doc, byId);
      if (join.length > 0 && !who.name) return null;
      const at = new Date().toISOString();
      const items = new Map(doc.items.map((i) => [i.id, i]));
      const owns = (itemId: string) => rights.joins?.[itemId]?.[byId] === browser;
      const events: EventBody[] = [];

      for (const { itemId, written } of join) {
        const item = items.get(itemId);
        if (!item || item.participants.includes(byId)) return null;
        const next = joinItem(item, byId, written, { at });
        if (!next) return null;
        items.set(itemId, next);
        rights.joins = { ...rights.joins, [itemId]: { ...rights.joins?.[itemId], [byId]: browser } };
        events.push({ kind: "bill_joined", name: item.name, amountMinor: joinShare(next, byId, written)! });
      }
      for (const { itemId, written } of change) {
        const item = items.get(itemId);
        if (!item || !owns(itemId)) return null;
        const from = joinShare(item, byId, item.overrides[byId]);
        const next = joinItem(item, byId, written, { at });
        if (!next || from === null) return null;
        items.set(itemId, next);
        events.push({ kind: "share_changed", name: item.name, from, to: joinShare(next, byId, written)! });
      }
      for (const { itemId } of leave) {
        const item = items.get(itemId);
        const next = item && owns(itemId) ? leaveItem(item, byId) : null;
        if (!item || !next) return null;
        items.set(itemId, next);
        events.push({ kind: "bill_left", name: item.name });
      }
      return { doc: { ...doc, items: doc.items.map((i) => items.get(i.id) ?? i) }, who, events };
    });
    if (!saved) return { ok: false, error: refused };
    changed(id);
    return { ok: true, data: null };
  });
}

export async function setMyDetails(
  id: string,
  personId: string,
  input: { bank: unknown; accountNo: unknown; payQr: unknown },
  byId?: unknown,
): Promise<Result> {
  return guard(async () => {
    const bank = bankSchema.safeParse(input.bank);
    const accountNo = bankSchema.safeParse(input.accountNo);
    const payQr = payQrSchema.safeParse(input.payQr);
    if (!bank.success || !accountNo.success || !payQr.success) return { ok: false, error: "invalid" };
    if (await tooManyChanges(id)) return { ok: false, error: "rate_limited" };
    const browser = await ensureBrowserHash();
    let refused = "forbidden";
    const saved = await writeBill(id, (doc, rights) => {
      if (doc.locked) {
        refused = "locked";
        return null;
      }
      const person = doc.people.find((p) => p.id === personId);
      if (!person) return null;
      if (!canSetDetails(doc, rights, personId, browser, byId)) {
        if (hasPayDetails(person)) refused = "taken";
        return null;
      }
      const details = {
        bank: bank.data || null,
        accountNo: bank.data ? accountNo.data || null : null,
        payQr: payQr.data,
        detailsAt: new Date().toISOString(),
      };
      if (!hasPayDetails(details) && !hasPayDetails(person)) return null;
      if (hasPayDetails(details)) rights.people = { ...rights.people, [personId]: browser };
      return {
        doc: { ...doc, people: doc.people.map((p) => (p.id === personId ? { ...p, ...details } : p)) },
        who: memberWho(doc, byId),
        events: [{ kind: "person_details", name: person.name }],
      };
    });
    if (refused === "taken") changed(id);
    if (!saved) return { ok: false, error: refused };
    changed(id);
    return { ok: true, data: null };
  });
}

export async function setBillLock(id: string, ownerToken: string | null, locked: boolean): Promise<Result> {
  return guard(async () => {
    if (!(await isOwner(id, ownerToken))) return { ok: false, error: "forbidden" };
    const saved = await writeBill(id, (doc) => {
      const next = { ...doc };
      delete next.locked;
      return {
        doc: locked ? { ...next, locked: true } : next,
        who: ownerWho(doc),
        events: [{ kind: locked ? "locked" : "unlocked" }],
      };
    });
    if (!saved) return { ok: false, error: "db" };
    changed(id);
    return { ok: true, data: null };
  });
}

export async function newOwnerLink(id: string, ownerToken: string | null): Promise<Result<{ ownerToken: string }>> {
  return guard(async () => {
    if (!(await isOwner(id, ownerToken))) return { ok: false, error: "forbidden" };
    const token = randomId(32);
    const { error } = await db()
      .from("bills")
      .update({ owner_token_hash: hashToken(token) })
      .eq("id", id);
    if (error) return { ok: false, error: "db" };
    return { ok: true, data: { ownerToken: token } };
  });
}

export async function checkOwnerLink(id: string, token: string): Promise<Result> {
  return guard(async () => {
    const { data } = await db().from("bills").select("owner_token_hash").eq("id", id).maybeSingle();
    return data && tokenMatches(data.owner_token_hash, token)
      ? { ok: true, data: null }
      : { ok: false, error: "forbidden" };
  });
}

const paymentSchema = z.object({
  from: z.string().min(1).max(40),
  to: z.string().min(1).max(40),
  amountMinor: z.int().min(1).max(100_000_000_00),
});

export async function addPayment(
  id: string,
  input: z.input<typeof paymentSchema>,
  { ownerToken, different = false, byId }: { ownerToken?: string | null; different?: boolean; byId?: unknown } = {},
): Promise<Result<{ id: string }>> {
  return guard(async () => {
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success || parsed.data.from === parsed.data.to) return { ok: false, error: "invalid" };
    const { from, to, amountMinor } = parsed.data;
    const owner = await isOwner(id, ownerToken);
    if (!owner && (await tooManyChanges(id))) return { ok: false, error: "rate_limited" };
    const browser = owner ? null : await ensureBrowserHash();

    for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
      const bill = await readBill(id);
      if (!bill) return { ok: false, error: "not_found" };
      const { doc, payments, version } = bill;
      const ids = new Set(doc.people.map((p) => p.id));
      if (!ids.has(from) || !ids.has(to)) return { ok: false, error: "invalid" };
      if (!owner) {
        const summary = summarize(doc, payments);
        const allowed = summary.remaining.some(
          (l) =>
            l.from === from && l.to === to && (different ? amountMinor <= summary.total : l.amount === amountMinor),
        );
        if (!allowed) return { ok: false, error: "invalid" };
      }
      const paymentId = randomUUID();
      const { data, error } = await db().rpc("add_payment", {
        p_id: id,
        p_version: version,
        p_payment: {
          id: paymentId,
          from_person: from,
          to_person: to,
          amount_minor: amountMinor,
          by_role: owner ? "owner" : "member",
          browser_hash: browser,
        },
        p_events: eventRows(owner ? ownerWho(doc) : memberWho(doc, byId ?? from), [
          { kind: "paid", from: personName(doc, from), to: personName(doc, to), amountMinor, paymentId },
        ]),
      });
      if (error) {
        console.error("[splitin] payment failed:", error);
        return { ok: false, error: "db" };
      }
      if (data) {
        changed(id);
        return { ok: true, data: { id: paymentId } };
      }
    }
    return { ok: false, error: "db" };
  });
}

export async function removePayment(
  id: string,
  paymentId: string,
  { ownerToken, byId }: { ownerToken?: string | null; byId?: unknown } = {},
): Promise<Result> {
  return guard(async () => {
    if (!z.uuid().safeParse(paymentId).success) return { ok: false, error: "invalid" };
    const { data: row } = await db()
      .from("payments")
      .select("from_person, to_person, amount_minor, by_role, browser_hash")
      .eq("id", paymentId)
      .eq("bill_id", id)
      .maybeSingle();
    const owner = await isOwner(id, ownerToken);
    if (!owner && row) {
      const browser = await browserHash();
      if (row.by_role !== "member" || !browser || row.browser_hash !== browser)
        return { ok: false, error: "forbidden" };
    }
    if (row) {
      const bill = await readBill(id);
      const doc = bill?.doc;
      const who: Who = !doc ? { role: owner ? "owner" : "member" } : owner ? ownerWho(doc) : memberWho(doc, byId);
      const { error } = await db().rpc("remove_payment", {
        p_id: id,
        p_payment_id: paymentId,
        p_events: eventRows(who, [
          {
            kind: "unpaid",
            from: doc ? personName(doc, row.from_person) : "?",
            to: doc ? personName(doc, row.to_person) : "?",
            amountMinor: Number(row.amount_minor),
          },
        ]),
      });
      if (error) {
        console.error("[splitin] undo failed:", error);
        return { ok: false, error: "db" };
      }
    }
    changed(id);
    return { ok: true, data: null };
  });
}
