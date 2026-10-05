import { Expired } from "@/components/shared/expired";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return <Expired t={t} />;
}
