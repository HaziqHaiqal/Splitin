import { NotFound } from "@/components/shared/not-found";
import { getI18n } from "@/i18n/server";

export default async function NotFoundPage() {
  const { t } = await getI18n();
  return <NotFound t={t} />;
}
