import "server-only";
import { cache } from "react";
import { mineOf, type BillDoc, type BillRights, type Mine, type Payment } from "@/lib/bill";
import {
  BILL_COLUMNS,
  BILL_COLUMNS_WITH_EVENTS,
  docFromRow,
  eventsFromRow,
  paymentsFromRow,
  rightsFromRow,
  type BillRow,
} from "@/lib/bill-rows";
import { browserHash } from "@/lib/browser-key";
import type { BillEvent } from "@/lib/history";
import { db } from "@/lib/supabase/server";

const ID = /^[A-Za-z0-9]{8,16}$/;

export type StoredBill = {
  doc: BillDoc;
  rights: BillRights;
  payments: Payment[];
  events: BillEvent[];
  version: number;
  ownerBrowser: string | null;
  createdAt: string;
  expiresAt: string;
};

export type SharedBill = {
  id: string;
  doc: BillDoc;
  payments: Payment[];
  events: BillEvent[];
  createdAt: string;
  expiresAt: string;
  mine: Mine;
};

export async function readBill(id: string, withEvents = false): Promise<StoredBill | null> {
  let query = db()
    .from("bills")
    .select(withEvents ? BILL_COLUMNS_WITH_EVENTS : BILL_COLUMNS)
    .eq("id", id)
    .order("position", { referencedTable: "bill_people" })
    .order("position", { referencedTable: "bill_items" })
    .order("position", { referencedTable: "bill_items.item_shares" })
    .order("created_at", { referencedTable: "payments" });
  if (withEvents)
    query = query.order("created_at", { referencedTable: "bill_events", ascending: false }).limit(200, {
      referencedTable: "bill_events",
    });
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as BillRow;
  return {
    doc: docFromRow(row),
    rights: rightsFromRow(row),
    payments: paymentsFromRow(row),
    events: eventsFromRow(row),
    version: row.version,
    ownerBrowser: row.browser_hash,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

export const getBill = cache(async (id: string): Promise<SharedBill | null> => {
  if (!ID.test(id)) return null;
  const bill = await readBill(id, true);
  if (!bill || Date.now() > new Date(bill.expiresAt).getTime()) return null;
  return {
    id,
    doc: bill.doc,
    payments: bill.payments,
    events: bill.events,
    createdAt: bill.createdAt,
    expiresAt: bill.expiresAt,
    mine: mineOf(bill.rights, bill.ownerBrowser, await browserHash()),
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
  if (gone.error) throw gone.error;
  return Boolean(old.data || gone.data);
});
