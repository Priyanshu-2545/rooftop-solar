import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { leads, projects, quotes } from "@/db/schema";
import { LinkButton } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/States";
import { getUser } from "@/lib/auth/current";
import { getT } from "@/lib/i18n";

export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/signin");
  if (user.role === "sales") redirect("/leads");
  const { t } = await getT();
  const rows = await getDb().select({ id: leads.id, humanId: leads.humanId, status: leads.status, band: leads.scoreBand, createdAt: leads.createdAt })
    .from(leads).where(eq(leads.ownerUserId, user.id)).orderBy(desc(leads.createdAt));
  const proj = await getDb().select({ id: projects.id }).from(projects).innerJoin(quotes, eq(quotes.id, projects.quoteId))
    .innerJoin(leads, eq(leads.id, quotes.leadId)).where(eq(leads.ownerUserId, user.id)).limit(1);
  return (
    <section>
      <h1 className="display mb-6 text-4xl">{user.name.split(" ")[0]}</h1>
      {rows.length === 0 ? (
        <EmptyState title={t("result.title")} body={t("lead.s1.title")} actionHref="/lead/new" actionLabel={t("common.newLead")} />
      ) : (
        <>
          <ul className="mb-8 divide-y divide-hairline border-y border-hairline">
            {rows.map((l) => (
              <li key={l.id}>
                <Link href={`/leads/${l.id}`} className="flex min-h-14 items-center justify-between gap-3 py-3">
                  <span className="num font-semibold">{l.humanId}</span>
                  <Chip kind={l.band ?? "plain"}>{l.status.replace("_", " ")}</Chip>
                </Link>
              </li>
            ))}
          </ul>
          {proj[0] ? <p className="mb-6"><Link className="underline underline-offset-4" href={`/projects/${proj[0].id}`}>{t("common.myProject")}</Link></p> : null}
          <LinkButton href="/lead/new">{t("common.newLead")}</LinkButton>
        </>
      )}
    </section>
  );
}
