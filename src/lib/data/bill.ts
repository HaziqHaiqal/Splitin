import "server-only";
import { cache } from "react";
import type { BillDoc, Payment } from "@/lib/bill";
import type { BillEvent } from "@/lib/history";
import { db } from "@/lib/supabase/server";

export const KEEP_DAYS = 30;
const DAY = 86_400_000;
const ID = /^[A-Za-z0-9]{8,16}$/;

export type SharedBill = {
  id: string;
  doc: BillDoc;
  payments: Payment[];
  events: BillEvent[];
  createdAt: string;
  expiresAt: string;
};

export const getBill = cache(async (id: string): Promise<SharedBill | null> => {
  if (!ID.test(id)) return null;
  const client = db();
  const { data, error } = await client.from("bills").select("id, doc, created_at").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const created = new Date(data.created_at).getTime();
  if (Date.now() - created > KEEP_DAYS * DAY) return null;

  const { data: rows, error: payError } = await client
    .from("payments")
    .select("id, from_person, to_person, amount_minor, by_role, created_at")
    .eq("bill_id", id)
    .order("created_at");
  if (payError) throw payError;

  const { data: eventRows, error: eventError } = await client
    .from("bill_events")
    .select("id, kind, by_role, by_person_id, by_name, data, created_at")
    .eq("bill_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (eventError) console.error("[splitin] history failed:", eventError);

  return {
    id: data.id,
    doc: data.doc as BillDoc,
    payments: rows.map((r) => ({
      id: r.id,
      from: r.from_person,
      to: r.to_person,
      amountMinor: Number(r.amount_minor),
      byRole: r.by_role,
      createdAt: r.created_at,
    })),
    events: (eventRows ?? []).map(
      (r) =>
        ({
          ...r.data,
          id: r.id,
          kind: r.kind,
          byRole: r.by_role,
          byPersonId: r.by_person_id ?? undefined,
          byName: r.by_name ?? undefined,
          createdAt: r.created_at,
        }) as BillEvent,
    ),
    createdAt: data.created_at,
    expiresAt: new Date(created + KEEP_DAYS * DAY).toISOString(),
  };
});

export const linkExpired = cache(async (id: string): Promise<boolean> => {
  if (!ID.test(id)) return false;
  const client = db();
  const [old, gone] = await Promise.all([
    client.from("bills").select("id").eq("id", id).maybeSingle(),
    client.from("expired_bills").select("id").eq("id", id).maybeSingle(),
  ]);
  if (old.error) throw old.error;
  return Boolean(old.data || (!gone.error && gone.data));
});
