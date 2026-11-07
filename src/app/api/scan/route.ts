import { NextResponse } from "next/server";
import { ensureBrowserHash, ipHash } from "@/lib/browser-key";
import { readReceipt } from "@/lib/gemini";
import { SCAN_TYPES, type ScanError } from "@/lib/receipt-scan";
import { db } from "@/lib/supabase/server";

export const maxDuration = 60;

const PER_PHONE = 10;
const PER_IP = 30;
const PER_DAY = 500;
const MAX_BYTES = 4_000_000;

const fail = (error: ScanError, status: number) => NextResponse.json({ ok: false, error }, { status });

async function scansToday(column?: "browser_hash" | "ip_hash", value?: string) {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  let query = db().from("receipt_scans").select("id", { count: "exact", head: true }).gte("created_at", since);
  if (column && value) query = query.eq(column, value);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function POST(request: Request) {
  try {
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin") return fail("failed", 403);
    const key = process.env.GEMINI_API_KEY;
    if (!key) return fail("off", 503);
    const photo = (await request.formData().catch(() => null))?.get("photo");
    if (!(photo instanceof Blob) || photo.size === 0 || photo.size > MAX_BYTES || !SCAN_TYPES.includes(photo.type))
      return fail("photo", 400);

    const phone = await ensureBrowserHash();
    const ip = await ipHash();
    const [byPhone, byIp, all] = await Promise.all([
      scansToday("browser_hash", phone),
      scansToday("ip_hash", ip),
      scansToday(),
    ]);
    if (byPhone >= PER_PHONE || byIp >= PER_IP) return fail("limit", 429);
    if (all >= PER_DAY) return fail("busy", 503);
    const { error } = await db().from("receipt_scans").insert({ browser_hash: phone, ip_hash: ip });
    if (error) throw error;

    const result = await readReceipt(key, photo);
    if (result.ok) return NextResponse.json({ ok: true, data: result.scan });
    return fail(result.error, result.error === "busy" ? 503 : 422);
  } catch (error) {
    console.error("[splitin] scan failed:", error);
    return fail("failed", 500);
  }
}
