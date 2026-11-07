import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { leads, projectStages, projects, quotes, users } from "@/db/schema";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/States";
import { requireUser } from "@/lib/auth/current";
import { getT } from "@/lib/i18n";
import { stageLabel } from "@/lib/projects/labels";
import { daysInStage, isStuck } from "@/lib/projects/stuck";

export const metadata = { title: "Projects" };

export default async function Projects() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const db = getDb();
  const stages = await db.select().from(projectStages).orderBy(asc(projectStages.order));
  const rows = await db.select({ p: projects, lead: leads, name: users.name }).from(projects)
    .innerJoin(quotes, eq(quotes.id, projects.quoteId)).innerJoin(leads, eq(leads.id, quotes.leadId)).innerJoin(users, eq(users.id, leads.ownerUserId))
    .orderBy(asc(projects.stageEnteredAt));

  if (user.role !== "sales") {
    const mine = rows.find((r) => r.lead.ownerUserId === user.id);
    if (mine) redirect(`/projects/${mine.p.id}`);
    return <section><h1 className="display mb-4 text-3xl">{t("common.myProject")}</h1><EmptyState title={t("status.empty")} /></section>;
  }

  const now = new Date();
  const info = rows.map((r) => {
    const st = stages.find((s) => s.code === r.p.stageCode);
    return { ...r, st, days: daysInStage(r.p.stageEnteredAt, now), stuck: isStuck(st, r.p.stageEnteredAt, now) };
  });
  const stuck = info.filter((r) => r.stuck);
  const line = (r: (typeof info)[number]) => (
    <li key={r.p.id}>
      <Link href={`/projects/${r.p.id}`} className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-3">
        <span><span className="num font-semibold">{r.p.humanId}</span> <span className="text-muted">{r.name}</span></span>
        <span className="flex items-center gap-2"><span>{r.st ? stageLabel(r.st, "en") : r.p.stageCode}</span>
          <span className="num text-sm text-muted">{r.days}d</span>{r.stuck ? <Chip kind="warn">Stuck</Chip> : null}</span>
      </Link>
    </li>
  );
  void locale;

  return (
    <section>
      <h1 className="display mb-6 text-4xl">{t("sales.projects")}</h1>
      {/* Von Restorff: the only loud thing on the page is what needs action */}
      <h2 className="display mb-2 text-2xl">{t("sales.stuck")}</h2>
      {stuck.length === 0 ? <p className="mb-8 text-muted">{t("sales.stuck.none")}</p> : (
        <ul className="mb-8 divide-y divide-hairline border-y-2 border-warn">{stuck.map(line)}</ul>
      )}
      <h2 className="display mb-2 text-2xl">All projects</h2>
      {info.length === 0 ? <EmptyState title="No projects yet" body="A project starts when a homeowner accepts a quote." /> : <ul className="divide-y divide-hairline border-y border-hairline">{info.map(line)}</ul>}
    </section>
  );
}
