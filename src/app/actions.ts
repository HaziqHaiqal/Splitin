"use server";

import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { refresh } from "next/cache";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { isLocale, LOCALE_COOKIE } from "@/i18n";
import {
  joinerOf,
  joinItem,
  joinShare,
  leaveItem,
  liveSecrets,
  mergeMemberChanges,
  repeatedName,
  splitItem,
  summarize,
  withNewPeople,
  withoutOwnItem,
  type BillDoc,
  type BillSecrets,
  type Item,
  type Payment,
  type Person,
} from "@/lib/bill";
import { bankSchema, billDocSchema, itemSchema, MAX_ITEMS, MAX_PEOPLE, personNameSchema } from "@/lib/bill-schema";
import { getBill, linkExpired } from "@/lib/data/bill";
import { diffDocs, memberWho, ownerWho, personName, type EventBody, type Who } from "@/lib/history";
import { broadcastChange } from "@/lib/realtime-server";
import { db } from "@/lib/supabase/server";
import { CODE_LENGTH } from "@/lib/utils";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const BILLS_PER_HOUR = 30;
const MEMBER_CHANGES_PER_HOUR = 100;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomId(length: number) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

const newCode = () =>
  Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

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

async function isOwner(id: string, token: unknown): Promise<boolean> {
  if (typeof token !== "string" || token.length < 16) return false;
  const { data } = await db().from("bills").select("owner_token_hash").eq("id", id).maybeSingle();
  return Boolean(data && data.owner_token_hash === hashToken(token));
}

async function logEvents(id: string, who: Who, events: EventBody[]) {
  if (events.length === 0) return;
  const rows = events.map(({ kind, ...data }) => ({
    bill_id: id,
    kind,
    by_role: who.role,
    by_person_id: who.personId ?? null,
    by_name: who.name ?? null,
    data,
  }));
  const { error } = await db().from("bill_events").insert(rows);
  if (error) console.error("[splitin] history failed:", error);
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

const paymentKey = (paymentId: string) =>
  createHmac("sha256", signingKey()).update(`payment:${paymentId}`).digest("hex").slice(0, 32);

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  refresh();
}

export async function publishBill(doc: BillDoc): Promise<Result<{ id: string; ownerToken: string }>> {
  return guard(async () => {
    const parsed = billDocSchema.safeParse(doc);
    if (!parsed.success) return { ok: false, error: "invalid" };
    if (repeatedName(parsed.data as BillDoc)) return { ok: false, error: "duplicate" };

    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
    const creatorHash = createHmac("sha256", signingKey()).update(ip).digest("hex").slice(0, 32);
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await db()
      .from("bills")
      .select("id", { count: "exact", head: true })
      .eq("creator_hash", creatorHash)
      .gte("created_at", since);
    if ((count ?? 0) >= BILLS_PER_HOUR) return { ok: false, error: "rate_limited" };

    const ownerToken = randomId(32);
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = newCode();
      const { error } = await db()
        .from("bills")
        .insert({ id, doc: parsed.data, owner_token_hash: hashToken(ownerToken), creator_hash: creatorHash });
      if (!error) {
        await logEvents(id, ownerWho(parsed.data as BillDoc), [{ kind: "created" }]);
        return { ok: true, data: { id, ownerToken } };
      }
      if (error.code !== "23505") return { ok: false, error: "db" };
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

async function writeDoc(
  id: string,
  change: (doc: BillDoc, secrets: BillSecrets) => BillDoc | null,
): Promise<BillDoc | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: bill } = await db().from("bills").select("doc, secrets, updated_at").eq("id", id).maybeSingle();
    if (!bill) return null;
    const secrets = bill.secrets as BillSecrets;
    const next = change(bill.doc as BillDoc, secrets);
    if (!next) return null;
    const { data, error } = await db()
      .from("bills")
      .update({ doc: next, secrets: liveSecrets(next, secrets), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("updated_at", bill.updated_at)
      .select("id");
    if (error) return null;
    if (data.length > 0) return next;
  }
  return null;
}

export async function saveBill(
  id: string,
  ownerToken: string,
  doc: BillDoc,
  seenAt = "",
): Promise<Result<{ doc: BillDoc }>> {
  return guard(async () => {
    const parsed = billDocSchema.safeParse(doc);
    if (!parsed.success) return { ok: false, error: "invalid" };
    if (!(await isOwner(id, ownerToken))) return { ok: false, error: "forbidden" };
    let events: EventBody[] = [];
    let refused = "db";
    const saved = await writeDoc(id, (current) => {
      const next = mergeMemberChanges(current, parsed.data as BillDoc, seenAt);
      if (repeatedName(next)) {
        refused = "duplicate";
        return null;
      }
      events = diffDocs(current, next);
      return next;
    });
    if (!saved) return { ok: false, error: refused };
    await logEvents(id, ownerWho(saved), events);
    after(() => broadcastChange(id));
    return { ok: true, data: { doc: saved } };
  });
}

export async function loadBillDoc(id: string): Promise<Result<{ doc: BillDoc }>> {
  return guard(async () => {
    const { data } = await db().from("bills").select("doc").eq("id", id).maybeSingle();
    if (!data) return { ok: false, error: "not_found" };
    return { ok: true, data: { doc: data.doc as BillDoc } };
  });
}

const newPeopleSchema = z.array(z.object({ id: z.string().min(1).max(40), name: personNameSchema })).max(10);

export async function addMemberItem(
  id: string,
  input: Item,
  byId?: unknown,
  newPeople: unknown = [],
): Promise<Result<{ id: string; token: string }>> {
  return guard(async () => {
    const parsed = itemSchema.safeParse(input);
    const added = newPeopleSchema.safeParse(newPeople);
    if (!parsed.success || !added.success) return { ok: false, error: "invalid" };
    if (await tooManyChanges(id)) return { ok: false, error: "rate_limited" };
    const token = randomId(32);
    const tokenHash = hashToken(token);
    const { name, amountMinor, paidBy, participants, overrides } = parsed.data;
    const item: Item = { id: randomId(8), name, amountMinor, paidBy, participants, overrides };
    let events: EventBody[] = [];
    let who: Who = { role: "member" };
    let refused = "invalid";
    const saved = await writeDoc(id, (current, secrets) => {
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
      who = memberWho(current, byId);
      const people = new Set(doc.people.map((p) => p.id));
      const known = people.has(item.paidBy) && item.participants.every((p) => people.has(p));
      const fits = splitItem(item.amountMinor, item.participants, item.overrides).ok;
      if (!known || !fits || doc.items.length >= MAX_ITEMS || doc.people.length > MAX_PEOPLE) return null;
      events = [
        ...added.data.map((p): EventBody => ({ kind: "person_added", name: p.name })),
        { kind: "item_added", name: item.name, amountMinor: item.amountMinor, payer: personName(doc, item.paidBy) },
      ];
      secrets.items = { ...secrets.items, [item.id]: tokenHash };
      secrets.people = { ...secrets.people, ...Object.fromEntries(added.data.map((p) => [p.id, tokenHash])) };
      return { ...doc, items: [...doc.items, { ...item, addedAt: at }] };
    });
    if (!saved) return { ok: false, error: refused };
    await logEvents(id, who, events);
    changed(id);
    return { ok: true, data: { id: item.id, token } };
  });
}

export async function removeMemberItem(id: string, itemId: string, token: unknown, byId?: unknown): Promise<Result> {
  return guard(async () => {
    if (typeof token !== "string" || token.length < 16) return { ok: false, error: "forbidden" };
    if (await tooManyChanges(id)) return { ok: false, error: "rate_limited" };
    const tokenHash = hashToken(token);
    let events: EventBody[] = [];
    let who: Who = { role: "member" };
    let refused = "forbidden";
    const saved = await writeDoc(id, (doc, secrets) => {
      if (doc.locked) {
        refused = "locked";
        return null;
      }
      const next = withoutOwnItem(doc, secrets, itemId, tokenHash);
      const item = doc.items.find((i) => i.id === itemId);
      if (!next || !item) return null;
      events = [{ kind: "item_deleted", name: item.name, amountMinor: item.amountMinor }];
      who = memberWho(doc, byId);
      return next;
    });
    if (!saved) return { ok: false, error: refused };
    await logEvents(id, who, events);
    changed(id);
    return { ok: true, data: null };
  });
}

export async function addMyName(id: string, input: unknown): Promise<Result<{ person: Person; key: string }>> {
  return guard(async () => {
    const parsed = personNameSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid" };
    if (await tooManyChanges(id)) return { ok: false, error: "rate_limited" };
    const key = randomId(32);
    const personId = randomId(6);
    let person: Person | undefined;
    let refused = "invalid";
    const saved = await writeDoc(id, (current, secrets) => {
      if (current.locked) {
        refused = "locked";
        return null;
      }
      const doc = withNewPeople(current, [{ id: personId, name: parsed.data }], new Date().toISOString());
      if (!doc) {
        refused = "duplicate";
        return null;
      }
      if (doc.people.length > MAX_PEOPLE) return null;
      person = doc.people[doc.people.length - 1];
      secrets.people = { ...secrets.people, [personId]: hashToken(key) };
      return doc;
    });
    if (!saved || !person) return { ok: false, error: refused };
    await logEvents(id, { role: "member", personId: person.id, name: person.name }, [
      { kind: "person_joined", name: person.name },
    ]);
    changed(id);
    return { ok: true, data: { person, key } };
  });
}

const myBillsSchema = z.object({
  join: z.array(z.object({ itemId: z.string(), written: z.int().min(1).optional() })).max(MAX_ITEMS),
  change: z
    .array(z.object({ itemId: z.string(), token: z.string(), written: z.int().min(1).optional() }))
    .max(MAX_ITEMS),
  leave: z.array(z.object({ itemId: z.string(), token: z.string() })).max(MAX_ITEMS),
});

export type MyBillChanges = z.infer<typeof myBillsSchema>;

export async function saveMyBills(id: string, byId: unknown, input: MyBillChanges): Promise<Result<{ token: string }>> {
  return guard(async () => {
    const parsed = myBillsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid" };
    if (await tooManyChanges(id)) return { ok: false, error: "rate_limited" };
    const { join, change, leave } = parsed.data;
    const token = randomId(32);
    let events: EventBody[] = [];
    let who: Who = { role: "member" };
    let refused = "invalid";
    const saved = await writeDoc(id, (doc, secrets) => {
      if (doc.locked) {
        refused = "locked";
        return null;
      }
      who = memberWho(doc, byId);
      if (join.length > 0 && !who.name) return null;
      const at = new Date().toISOString();
      const items = new Map(doc.items.map((i) => [i.id, i]));
      const log: EventBody[] = [];

      for (const { itemId, written } of join) {
        const item = items.get(itemId);
        if (!item || item.participants.includes(byId as string)) return null;
        const next = joinItem(item, byId as string, written, { at });
        if (!next) return null;
        items.set(itemId, next);
        secrets.joins = {
          ...secrets.joins,
          [itemId]: { ...secrets.joins?.[itemId], [byId as string]: hashToken(token) },
        };
        log.push({ kind: "bill_joined", name: item.name, amountMinor: joinShare(next, byId as string, written)! });
      }
      for (const { itemId, token: own, written } of change) {
        const item = items.get(itemId);
        const person = joinerOf(secrets, itemId, hashToken(own));
        if (!item || !person) return null;
        const from = joinShare(item, person, item.overrides[person]);
        const next = joinItem(item, person, written, { at });
        if (!next || from === null) return null;
        items.set(itemId, next);
        log.push({ kind: "share_changed", name: item.name, from, to: joinShare(next, person, written)! });
      }
      for (const { itemId, token: own } of leave) {
        const item = items.get(itemId);
        const person = joinerOf(secrets, itemId, hashToken(own));
        const next = item && person ? leaveItem(item, person) : null;
        if (!item || !next) return null;
        items.set(itemId, next);
        log.push({ kind: "bill_left", name: item.name });
      }
      events = log;
      return { ...doc, items: doc.items.map((i) => items.get(i.id) ?? i) };
    });
    if (!saved) return { ok: false, error: refused };
    await logEvents(id, who, events);
    changed(id);
    return { ok: true, data: { token } };
  });
}

export async function setMyDetails(
  id: string,
  personId: string,
  key: unknown,
  input: { bank: unknown; accountNo: unknown },
  byId?: unknown,
): Promise<Result> {
  return guard(async () => {
    const bank = bankSchema.safeParse(input.bank);
    const accountNo = bankSchema.safeParse(input.accountNo);
    if (typeof key !== "string" || key.length < 16) return { ok: false, error: "forbidden" };
    if (!bank.success || !accountNo.success) return { ok: false, error: "invalid" };
    if (await tooManyChanges(id)) return { ok: false, error: "rate_limited" };
    let name: string | undefined;
    let who: Who = { role: "member" };
    let refused = "forbidden";
    const saved = await writeDoc(id, (doc, secrets) => {
      if (doc.locked) {
        refused = "locked";
        return null;
      }
      const person = doc.people.find((p) => p.id === personId);
      if (!person || secrets.people?.[personId] !== hashToken(key)) return null;
      name = person.name;
      who = memberWho(doc, byId);
      const details = {
        bank: bank.data || null,
        accountNo: bank.data ? accountNo.data || null : null,
        detailsAt: new Date().toISOString(),
      };
      return { ...doc, people: doc.people.map((p) => (p.id === personId ? { ...p, ...details } : p)) };
    });
    if (!saved || !name) return { ok: false, error: refused };
    await logEvents(id, who, [{ kind: "person_details", name }]);
    changed(id);
    return { ok: true, data: null };
  });
}

export async function setBillLock(id: string, ownerToken: string, locked: boolean): Promise<Result> {
  return guard(async () => {
    if (!(await isOwner(id, ownerToken))) return { ok: false, error: "forbidden" };
    const saved = await writeDoc(id, (doc) => {
      const next = { ...doc };
      delete next.locked;
      return locked ? { ...next, locked: true } : next;
    });
    if (!saved) return { ok: false, error: "db" };
    await logEvents(id, ownerWho(saved), [{ kind: locked ? "locked" : "unlocked" }]);
    changed(id);
    return { ok: true, data: null };
  });
}

export async function checkOwnerLink(id: string, token: string): Promise<Result> {
  return guard(async () => ((await isOwner(id, token)) ? { ok: true, data: null } : { ok: false, error: "forbidden" }));
}

export async function personHasPayments(id: string, personId: string): Promise<Result<{ has: boolean }>> {
  return guard(async () => {
    const payments = await loadPayments(id);
    return { ok: true, data: { has: payments.some((p) => p.from === personId || p.to === personId) } };
  });
}

const paymentSchema = z.object({
  from: z.string().min(1).max(40),
  to: z.string().min(1).max(40),
  amountMinor: z.int().min(1).max(100_000_000_00),
});

async function loadPayments(id: string): Promise<Payment[]> {
  const { data } = await db()
    .from("payments")
    .select("id, from_person, to_person, amount_minor, by_role, created_at")
    .eq("bill_id", id);
  return (data ?? []).map((r) => ({
    id: r.id,
    from: r.from_person,
    to: r.to_person,
    amountMinor: Number(r.amount_minor),
    byRole: r.by_role,
    createdAt: r.created_at,
  }));
}

export async function addPayment(
  id: string,
  input: z.input<typeof paymentSchema>,
  { ownerToken, different = false }: { ownerToken?: string; different?: boolean } = {},
): Promise<Result<{ id: string; undoKey: string }>> {
  return guard(async () => {
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success || parsed.data.from === parsed.data.to) return { ok: false, error: "invalid" };
    const { data: bill } = await db().from("bills").select("doc").eq("id", id).maybeSingle();
    if (!bill) return { ok: false, error: "not_found" };
    const doc = bill.doc as BillDoc;
    const ids = new Set(doc.people.map((p) => p.id));
    if (!ids.has(parsed.data.from) || !ids.has(parsed.data.to)) return { ok: false, error: "invalid" };

    const owner = await isOwner(id, ownerToken);
    if (!owner) {
      if (await tooManyChanges(id)) return { ok: false, error: "rate_limited" };
      const summary = summarize(doc, await loadPayments(id));
      const { from, to, amountMinor } = parsed.data;
      const allowed = summary.remaining.some(
        (l) => l.from === from && l.to === to && (different ? amountMinor <= summary.total : l.amount === amountMinor),
      );
      if (!allowed) return { ok: false, error: "invalid" };
    }

    const { data, error } = await db()
      .from("payments")
      .insert({
        bill_id: id,
        from_person: parsed.data.from,
        to_person: parsed.data.to,
        amount_minor: parsed.data.amountMinor,
        by_role: owner ? "owner" : "member",
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: "db" };
    await logEvents(id, owner ? ownerWho(doc) : memberWho(doc, parsed.data.from), [
      {
        kind: "paid",
        from: personName(doc, parsed.data.from),
        to: personName(doc, parsed.data.to),
        amountMinor: parsed.data.amountMinor,
        paymentId: data.id,
      },
    ]);
    changed(id);
    return { ok: true, data: { id: data.id, undoKey: paymentKey(data.id) } };
  });
}

export async function removePayment(
  id: string,
  paymentId: string,
  { ownerToken, undoKey, byId }: { ownerToken?: string; undoKey?: unknown; byId?: unknown } = {},
): Promise<Result> {
  return guard(async () => {
    if (!z.uuid().safeParse(paymentId).success) return { ok: false, error: "invalid" };
    const { data: row } = await db()
      .from("payments")
      .select("from_person, to_person, amount_minor, by_role")
      .eq("id", paymentId)
      .eq("bill_id", id)
      .maybeSingle();
    const owner = await isOwner(id, ownerToken);
    if (!owner && (undoKey !== paymentKey(paymentId) || (row && row.by_role !== "member")))
      return { ok: false, error: "forbidden" };
    if (row) {
      const { error } = await db().from("payments").delete().eq("id", paymentId).eq("bill_id", id);
      if (error) return { ok: false, error: "db" };
      const { data: bill } = await db().from("bills").select("doc").eq("id", id).maybeSingle();
      const doc = bill?.doc as BillDoc | undefined;
      const who: Who = !doc ? { role: owner ? "owner" : "member" } : owner ? ownerWho(doc) : memberWho(doc, byId);
      await logEvents(id, who, [
        {
          kind: "unpaid",
          from: doc ? personName(doc, row.from_person) : "?",
          to: doc ? personName(doc, row.to_person) : "?",
          amountMinor: Number(row.amount_minor),
        },
      ]);
    }
    changed(id);
    return { ok: true, data: null };
  });
}
