import "server-only";
import { db } from "@/lib/supabase/server";

export const billChannel = (billId: string) => `bill:${billId}`;

/** Ping everyone viewing the bill so they re-fetch. Carries no data. */
export async function broadcastChange(billId: string) {
  try {
    const channel = db().channel(billChannel(billId));
    await channel.httpSend("changed", { at: Date.now() });
    await db().removeChannel(channel);
  } catch (error) {
    console.warn("[realtime] broadcast failed", error);
  }
}
