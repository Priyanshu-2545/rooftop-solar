import { headers } from "next/headers";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { projectStages } from "@/db/schema";
import { StageTimeline } from "@/components/project/StageTimeline";
import { hit } from "@/lib/auth/ratelimit";
import { getT } from "@/lib/i18n";
import { getPublicStatus } from "@/lib/projects/service";
import { formatDateIST } from "@/lib/sales/format";

export const metadata = { title: "Your solar project", robots: { index: false, follow: false } };

export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t, locale } = await getT();
  const db = getDb();
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await hit(db, `status:${ip}`, 30, 60, new Date()))) return <p role="alert" className="py-8">{t("status.rateLimited")}</p>;

  const s = await getPublicStatus(db, token);
  if (s.state !== "ok") return <section className="py-8"><h1 className="display mb-3 text-3xl">{t("status.title")}</h1><p>{t("status.revoked")}</p></section>;
  const stages = await db.select().from(projectStages).orderBy(asc(projectStages.order));
  return (
    <section>
      <h1 className="display mb-1 text-3xl">{s.firstName ? t("status.hello", { name: s.firstName }) : t("status.helloAnon")}</h1>
      <p className="mb-6 text-muted">{t("status.title")}</p>
      <StageTimeline t={t} locale={locale} stages={stages} current={s.stageCode} since={formatDateIST(s.stageEnteredAt)} />
      <p className="mb-6 text-sm text-muted">{t("status.explain.netMetering")}</p>
      {s.documentNames.length ? <ul className="mb-6 list-disc pl-5 text-muted">{s.documentNames.map((n, i) => <li key={i}>{n}</li>)}</ul> : null}
      <a href="tel:+917000000000" className="inline-flex min-h-12 items-center rounded-md border border-ink px-5 font-semibold">{t("status.contact")}</a>
    </section>
  );
}
