import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { messages } from "@/db/schema";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/States";
import { requireSalesUser } from "@/lib/auth/current";
import { formatDateIST } from "@/lib/sales/format";

export const metadata = { title: "Message log" };
const mask = (p: string) => `${p.slice(0, 3)}${"•".repeat(Math.max(p.length - 7, 0))}${p.slice(-4)}`;

export default async function MessageLog() {
  await requireSalesUser();
  const rows = await getDb().select().from(messages).orderBy(desc(messages.createdAt)).limit(100);
  return (
    <section>
      <h1 className="display mb-2 text-4xl">Message log</h1>
      <p className="mb-6 border-l-2 border-hairline pl-3 text-sm text-muted">Demo: messages are logged here and not sent. A real provider plugs in at <code>lib/messaging/provider.ts</code>. Numbers are masked.</p>
      {rows.length === 0 ? <EmptyState title="No messages yet" body="Messages appear here when a lead is scored, a quote is sent or a stage changes." /> : (
        <ul className="divide-y divide-hairline border-y border-hairline">
          {rows.map((m) => (
            <li key={m.id} className="py-3">
              <p className="mb-1 flex flex-wrap items-center gap-2"><span className="num font-semibold">{mask(m.toPhone)}</span><Chip>{m.channel}</Chip><Chip>{m.lang}</Chip><Chip kind="high">{m.status}</Chip><span className="num text-sm text-muted">{formatDateIST(m.createdAt)} · {m.template}</span></p>
              <p className="text-muted">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
