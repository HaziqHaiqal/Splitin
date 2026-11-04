import { db } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await db().from("bills").select("id").limit(1);
  return Response.json({ ok: !error }, { status: error ? 503 : 200 });
}
