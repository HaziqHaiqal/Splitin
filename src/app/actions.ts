"use server";

import { createHash, createHmac, randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { isLocale, LOCALE_COOKIE } from "@/i18n";
import {
  mergeFriendItems,
  splitItem,
  summarize,
  withoutOwnItem,
  type BillDoc,
  type Item,
  type Payment,
} from "@/lib/bill";
import { billDocSchema, itemSchema, MAX_ITEMS } from "@/lib/bill-schema";
import { actorName, diffDocs, personName, type EventActor, type EventBody } from "@/lib/history";
import { broadcastChange } from "@/lib/realtime-server";
import { db } from "@/lib/supabase/server";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const BILLS_PER_HOUR = 30;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function randomId(length: number) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

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

async function logEvents(id: string, actor: EventActor, events: EventBody[], by?: string) {
  if (events.length === 0) return;
  const rows = events.map(({ kind, ...data }) => ({ bill_id: id, kind, actor, data: by ? { ...data, by } : data }));
  const { error } = await db().from("bill_events").insert(rows);
  if (error) console.error("[splitin] history failed:", error);
}

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  refresh();
}

export async function publishBill(doc: BillDoc): Promise<Result<{ id: string; ownerToken: string }>> {
  return guard(async () => {
    const parsed = billDocSchema.safeParse(doc);
    if (!parsed.success) return { ok: false, error: "invalid" };

    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
    const creatorHash = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "splitin")
      .update(ip)
      .digest("hex")
      .slice(0, 32);
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await db()
      .from("bills")
      .select("id", { count: "exact", head: true })
      .eq("creator_hash", creatorHash)
      .gte("created_at", since);
    if ((count ?? 0) >= BILLS_PER_HOUR) return { ok: false, error: "rate_limited" };

    const ownerToken = randomId(32);
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = randomId(10);
      const { error } = await db()
        .from("bills")
        .insert({ id, doc: parsed.data, owner_token_hash: hashToken(ownerToken), creator_hash: creatorHash });
      if (!error) {
        await logEvents(id, "owner", [{ kind: "created" }]);
        return { ok: true, data: { id, ownerToken } };
      }
      if (error.code !== "23505") return { ok: false, error: "db" };
    }
    return { ok: false, error: "db" };
  });
}

async function writeDoc(id: string, change: (doc: BillDoc) => BillDoc | null): Promise<BillDoc | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: bill } = await db().from("bills").select("doc, updated_at").eq("id", id).maybeSingle();
    if (!bill) return null;
    const next = change(bill.doc as BillDoc);
    if (!next) return null;
    const { data, error } = await db()
      .from("bills")
      .update({ doc: next, updated_at: new Date().toISOString() })
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
    const saved = await writeDoc(id, (current) => {
      const next = mergeFriendItems(current, parsed.data as BillDoc, seenAt);
      events = diffDocs(current, next);
      return next;
    });
    if (!saved) return { ok: false, error: "db" };
    await logEvents(id, "owner", events);
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

export async function addFriendItem(
  id: string,
  input: Item,
  byId?: unknown,
): Promise<Result<{ id: string; token: string }>> {
  return guard(async () => {
    const parsed = itemSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid" };
    const token = randomId(32);
    const item: Item = { ...parsed.data, id: randomId(8), deleteHash: hashToken(token) };
    let events: EventBody[] = [];
    let by: string | undefined;
    const saved = await writeDoc(id, (doc) => {
      by = actorName(doc, byId);
      const people = new Set(doc.people.map((p) => p.id));
      const known = people.has(item.paidBy) && item.participants.every((p) => people.has(p));
      const fits = splitItem(item.amountMinor, item.participants, item.overrides).ok;
      if (!known || !fits || doc.items.length >= MAX_ITEMS) return null;
      events = [
        { kind: "item_added", name: item.name, amountMinor: item.amountMinor, payer: personName(doc, item.paidBy) },
      ];
      return { ...doc, items: [...doc.items, { ...item, addedAt: new Date().toISOString() }] };
    });
    if (!saved) return { ok: false, error: "invalid" };
    await logEvents(id, "friend", events, by);
    changed(id);
    return { ok: true, data: { id: item.id, token } };
  });
}

export async function removeFriendItem(id: string, itemId: string, token: unknown, byId?: unknown): Promise<Result> {
  return guard(async () => {
    if (typeof token !== "string" || token.length < 16) return { ok: false, error: "forbidden" };
    const tokenHash = hashToken(token);
    let events: EventBody[] = [];
    let by: string | undefined;
    const saved = await writeDoc(id, (doc) => {
      const next = withoutOwnItem(doc, itemId, tokenHash);
      const item = doc.items.find((i) => i.id === itemId);
      if (!next || !item) return null;
      events = [{ kind: "item_deleted", name: item.name, amountMinor: item.amountMinor }];
      by = actorName(doc, byId);
      return next;
    });
    if (!saved) return { ok: false, error: "forbidden" };
    await logEvents(id, "friend", events, by);
    changed(id);
    return { ok: true, data: null };
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
    .select("id, from_person, to_person, amount_minor, marked_by, created_at")
    .eq("bill_id", id);
  return (data ?? []).map((r) => ({
    id: r.id,
    from: r.from_person,
    to: r.to_person,
    amountMinor: Number(r.amount_minor),
    markedBy: r.marked_by,
    createdAt: r.created_at,
  }));
}

export async function addPayment(
  id: string,
  input: z.input<typeof paymentSchema>,
  ownerToken?: string,
  byId?: unknown,
): Promise<Result<{ id: string }>> {
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
      const open = summarize(doc, await loadPayments(id)).remaining;
      const { from, to, amountMinor } = parsed.data;
      if (!open.some((l) => l.from === from && l.to === to && l.amount === amountMinor))
        return { ok: false, error: "invalid" };
    }

    const { data, error } = await db()
      .from("payments")
      .insert({
        bill_id: id,
        from_person: parsed.data.from,
        to_person: parsed.data.to,
        amount_minor: parsed.data.amountMinor,
        marked_by: owner ? "owner" : "payer",
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: "db" };
    await logEvents(
      id,
      owner ? "owner" : "friend",
      [
        {
          kind: "paid",
          from: personName(doc, parsed.data.from),
          to: personName(doc, parsed.data.to),
          amountMinor: parsed.data.amountMinor,
        },
      ],
      owner ? undefined : actorName(doc, byId),
    );
    changed(id);
    return { ok: true, data: { id: data.id } };
  });
}

const UNDO_WINDOW_MS = 15 * 60_000;

export async function removePayment(
  id: string,
  paymentId: string,
  ownerToken?: string,
  byId?: unknown,
): Promise<Result> {
  return guard(async () => {
    if (!z.uuid().safeParse(paymentId).success) return { ok: false, error: "invalid" };
    const { data: row } = await db()
      .from("payments")
      .select("from_person, to_person, amount_minor, marked_by, created_at")
      .eq("id", paymentId)
      .eq("bill_id", id)
      .maybeSingle();
    const owner = await isOwner(id, ownerToken);
    if (
      !owner &&
      (!row || row.marked_by !== "payer" || Date.now() - new Date(row.created_at).getTime() > UNDO_WINDOW_MS)
    )
      return { ok: false, error: "forbidden" };
    if (row) {
      const { error } = await db().from("payments").delete().eq("id", paymentId).eq("bill_id", id);
      if (error) return { ok: false, error: "db" };
      const { data: bill } = await db().from("bills").select("doc").eq("id", id).maybeSingle();
      const doc = bill?.doc as BillDoc | undefined;
      await logEvents(
        id,
        owner ? "owner" : "friend",
        [
          {
            kind: "unpaid",
            from: doc ? personName(doc, row.from_person) : "?",
            to: doc ? personName(doc, row.to_person) : "?",
            amountMinor: Number(row.amount_minor),
          },
        ],
        owner || !doc ? undefined : actorName(doc, byId),
      );
    }
    changed(id);
    return { ok: true, data: null };
  });
}
