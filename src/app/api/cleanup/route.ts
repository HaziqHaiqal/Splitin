import { NextResponse } from "next/server";
import { readBill } from "@/lib/data/bill";
import { photos } from "@/lib/data/photos";

export const maxDuration = 60;

const PAGE = 100;

async function listAll(prefix: string) {
  const names: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await photos().list(prefix, { limit: PAGE, offset });
    if (error) throw error;
    names.push(...data.map((entry) => entry.name));
    if (data.length < PAGE) return names;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    let removed = 0;
    for (const billId of await listAll("")) {
      const names = await listAll(billId);
      const bill = await readBill(billId);
      const kept = new Set(bill?.doc.items.filter((item) => item.lines).map((item) => item.id));
      const gone = names.filter((name) => !kept.has(name)).map((name) => `${billId}/${name}`);
      if (gone.length === 0) continue;
      const { error } = await photos().remove(gone);
      if (error) throw error;
      removed += gone.length;
    }
    return NextResponse.json({ ok: true, removed });
  } catch (error) {
    console.error("[splitin] cleanup failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
