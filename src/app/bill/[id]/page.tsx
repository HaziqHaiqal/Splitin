import type { Metadata } from "next";
import { Expired } from "@/components/shared/expired";
import { NotFound } from "@/components/shared/not-found";
import { SharedBill } from "@/components/shared/shared-bill";
import { getI18n } from "@/i18n/server";
import { summarize } from "@/lib/bill";
import { getBill, linkExpired } from "@/lib/data/bill";

export async function generateMetadata({ params }: PageProps<"/bill/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [bill, { t }] = await Promise.all([getBill(id), getI18n()]);
  if (!bill) return { title: (await linkExpired(id)) ? t.expired.title : t.notFound.title, robots: { index: false } };
  const s = summarize(bill.doc, bill.payments);
  const description = `RM ${(s.total / 100).toFixed(2)} · ${bill.doc.people.length} · ${s.remaining.length}`;
  return {
    title: bill.doc.title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: bill.doc.title, description },
  };
}

export default async function BillPage({ params }: PageProps<"/bill/[id]">) {
  const { id } = await params;
  const [bill, { t }] = await Promise.all([getBill(id), getI18n()]);
  if (!bill) return (await linkExpired(id)) ? <Expired t={t} /> : <NotFound t={t} />;
  return (
    <SharedBill
      bill={{
        id: bill.id,
        doc: bill.doc,
        payments: bill.payments,
        createdAt: bill.createdAt,
        expiresAt: bill.expiresAt,
      }}
    />
  );
}
