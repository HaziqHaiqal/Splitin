"use server";

import { createHash, createHmac, randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { isLocale, LOCALE_COOKIE } from "@/i18n";
import { summarize, type BillDoc, type Payment } from "@/lib/bill";
import { billDocSchema } from "@/lib/bill-schema";
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

/**
 * Actions answer with a result instead of throwing. A thrown action replaces the whole page with
 * the framework's "This page couldn't load" screen; this way the screen that called it shows its
 * own message, and the real reason (for example a missing Supabase key) goes to the server log.
 */
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

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  refresh();
}

/** Saves a new shared bill and returns its link id plus the secret that lets this device edit it. */
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
      if (!error) return { ok: true, data: { id, ownerToken } };
      if (error.code !== "23505") return { ok: false, error: "db" };
    }
    return { ok: false, error: "db" };
  });
}

/** Owner-only: replace the people and bills of a shared bill. */
export async function saveBill(id: string, ownerToken: string, doc: BillDoc): Promise<Result> {
  return guard(async () => {
    const parsed = billDocSchema.safeParse(doc);
    if (!parsed.success) return { ok: false, error: "invalid" };
    if (!(await isOwner(id, ownerToken))) return { ok: false, error: "forbidden" };
    const { error } = await db()
      .from("bills")
      .update({ doc: parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: "db" };
    after(() => broadcastChange(id));
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

/**
 * Mark a payment as paid. The owner can mark any of the bill's payments. Anyone else (the person
 * paying, from the link) can only mark a payment that is still open in the settle-up plan, for
 * exactly its amount. There are no logins, so this is the closest we get to "only the payer".
 */
export async function addPayment(
  id: string,
  input: z.input<typeof paymentSchema>,
  ownerToken?: string,
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
    changed(id);
    return { ok: true, data: { id: data.id } };
  });
}

const UNDO_WINDOW_MS = 15 * 60_000;

/** Undo a paid mark. The owner can undo any; anyone else only a payer's own mark from the last 15 minutes (the Undo button). */
export async function removePayment(id: string, paymentId: string, ownerToken?: string): Promise<Result> {
  return guard(async () => {
    if (!z.uuid().safeParse(paymentId).success) return { ok: false, error: "invalid" };
    if (!(await isOwner(id, ownerToken))) {
      const { data: row } = await db()
        .from("payments")
        .select("marked_by, created_at")
        .eq("id", paymentId)
        .eq("bill_id", id)
        .maybeSingle();
      if (!row || row.marked_by !== "payer" || Date.now() - new Date(row.created_at).getTime() > UNDO_WINDOW_MS)
        return { ok: false, error: "forbidden" };
    }
    const { error } = await db().from("payments").delete().eq("id", paymentId).eq("bill_id", id);
    if (error) return { ok: false, error: "db" };
    changed(id);
    return { ok: true, data: null };
  });
}
