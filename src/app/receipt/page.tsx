import type { Metadata } from "next";
import { ReceiptScreen } from "@/components/receipt/receipt-screen";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.receipt.title };
}

export default function ReceiptPage() {
  return <ReceiptScreen />;
}
