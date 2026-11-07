import { notFound, redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { documents, projectEvents, projectStages, users } from "@/db/schema";
import { MoveStageForm, StatusLinkPanel } from "@/components/project/SalesControls";
import { StageTimeline } from "@/components/project/StageTimeline";
import { getUser } from "@/lib/auth/current";
import { getT } from "@/lib/i18n";
import { stageLabel } from "@/lib/projects/labels";
import { getProjectFor } from "@/lib/projects/service";
import { formatDateIST } from "@/lib/sales/format";

export const metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/signin");
  const db = getDb();
  const project = await getProjectFor(db, user, id);
  if (!project) notFound();
  const { t, locale } = await getT();
  const sales = user.role === "sales";
  const [stages, events, docs] = await Promise.all([
    db.select().from(projectStages).orderBy(asc(projectStages.order)),
    db.select({ e: projectEvents, actor: users.name }).from(projectEvents).leftJoin(users, eq(users.id, projectEvents.actorUserId)).where(eq(projectEvents.projectId, project.id)).orderBy(desc(projectEvents.at)),
    db.select({ id: documents.id, filename: documents.filename, kind: documents.kind, at: documents.at }).from(documents).where(eq(documents.projectId, project.id)).orderBy(desc(documents.at)),
  ]);
  const cur = stages.find((s) => s.code === project.stageCode)!;
  const later = stages.filter((s) => s.order > cur.order).map((s) => ({ code: s.code, label: stageLabel(s, "en") }));

  return (
    <section>
      <p className="num mb-1 text-sm text-muted">{project.humanId} · {project.lead.humanId}</p>
      <h1 className="display mb-6 text-3xl">{t("status.title")}</h1>
      <StageTimeline t={t} locale={locale} stages={stages} current={project.stageCode} since={formatDateIST(project.stageEnteredAt)} />

      {docs.length ? (
        <div className="mb-8"><h2 className="display mb-2 text-2xl">Documents</h2>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {docs.map((d) => <li key={d.id}><a className="flex min-h-12 items-center justify-between py-2 underline-offset-4 hover:underline" href={`/api/documents/${d.id}`}><span>{d.filename}</span><span className="text-sm text-muted">{d.kind}</span></a></li>)}
          </ul></div>
      ) : null}

      <h2 className="display mb-2 text-2xl">History</h2>
      <ul className="mb-10 divide-y divide-hairline border-y border-hairline">
        {events.map(({ e, actor }) => {
          const st = stages.find((s) => s.code === e.stageCode);
          return (
            <li key={e.id} className="py-2">
              <p><span className="font-semibold">{st ? stageLabel(st, locale) : e.stageCode}</span> <span className="num text-sm text-muted">{formatDateIST(e.at)}</span></p>
              {e.note ? <p className="text-muted">{e.note}</p> : null}
              {sales && actor ? <p className="text-xs text-muted">by {actor}</p> : null}
            </li>
          );
        })}
      </ul>

      {sales ? (
        <div className="grid gap-10 md:grid-cols-2">
          <div><h2 className="display mb-3 text-2xl">Move stage</h2><MoveStageForm projectId={project.id} options={later} /></div>
          <div><h2 className="display mb-3 text-2xl">Customer status link</h2>
            <StatusLinkPanel projectId={project.id} hasLink={!!project.statusTokenHash} revoked={!!project.tokenRevokedAt} /></div>
        </div>
      ) : null}
    </section>
  );
}
