import { getT } from "@/lib/i18n";

export default async function Offline() {
  const { t } = await getT();
  return (
    <section>
      <h1 className="display text-3xl">{t("common.offline")}</h1>
    </section>
  );
}
