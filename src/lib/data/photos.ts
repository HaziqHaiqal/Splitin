import "server-only";
import { db } from "@/lib/supabase/server";

const ID = /^[A-Za-z0-9]{1,40}$/;

export const PHOTO_BYTES = 4_000_000;
export const photos = () => db().storage.from("receipts");
export const photoPath = (billId: string, itemId: string) =>
  ID.test(billId) && ID.test(itemId) ? `${billId}/${itemId}` : null;
