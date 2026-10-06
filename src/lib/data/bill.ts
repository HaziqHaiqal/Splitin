import "server-only";
import { cache } from "react";
import type { BillDoc, Payment } from "@/lib/bill";
import { db } from "@/lib/supabase/server";

export const KEEP_DAYS = 30;
const DAY = 86_400_000;

export type SharedBill = {
  id: string;
  doc: BillDoc;
  payments: Payment[];
  createdAt: string;
  expiresAt: string;
};

/** Loads a shared bill, or null when it never existed or is older than 30 days. */
export const getBill = cache(async (id: string): Promise<SharedBill | null> => {
  if (!/^[A-Za-z0-9]{8,16}$/.test(id)) return null;
  const client = db();
  const { data, error } = await client.from("bills").select("id, doc, created_at").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const created = new Date(data.created_at).getTime();
  if (Date.now() - created > KEEP_DAYS * DAY) return null;

  const { data: rows, error: payError } = await client
    .from("payments")
    .select("id, from_person, to_person, amount_minor, marked_by, created_at")
    .eq("bill_id", id)
    .order("created_at");
  if (payError) throw payError;

  return {
    id: data.id,
    doc: data.doc as BillDoc,
    payments: rows.map((r) => ({
      id: r.id,
      from: r.from_person,
      to: r.to_person,
      amountMinor: Number(r.amount_minor),
      markedBy: r.marked_by,
      createdAt: r.created_at,
    })),
    createdAt: data.created_at,
    expiresAt: new Date(created + KEEP_DAYS * DAY).toISOString(),
  };
});
