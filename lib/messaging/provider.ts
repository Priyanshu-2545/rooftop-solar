// MOCK messaging boundary (A18/5.6). Sending = insert a row with status mock_sent. No real SMS/WhatsApp.
// To go live: replace the body of `deliver` with a provider call (e.g. a WhatsApp Business API client).
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads, messages, users } from "@/db/schema";
import { makeT, type Locale, type MessageKey } from "@/lib/i18n/make-t";

type Channel = "whatsapp" | "sms";

async function deliver(db: Db, m: { toPhone: string; channel: Channel; template: string; body: string; lang: Locale }) {
  const [row] = await db.insert(messages).values({ ...m, status: "mock_sent" }).returning();
  return row;
}

/** Messages only ever go to the lead owner's own phone (never an arbitrary number). */
export async function sendToLeadOwner(
  db: Db,
  p: { leadId: string; template: string; key: MessageKey; vars?: Record<string, string | number>; keyVars?: Record<string, MessageKey>; channel?: Channel },
) {
  const [row] = await db
    .select({ phone: users.phone, lang: users.language, name: users.name })
    .from(leads).innerJoin(users, eq(users.id, leads.ownerUserId)).where(eq(leads.id, p.leadId)).limit(1);
  if (!row) return null;
  const t = makeT(row.lang);
  // keyVars are translated in the OWNER'S language (e.g. the "next step" sentence)
  const translated = Object.fromEntries(Object.entries(p.keyVars ?? {}).map(([k, key]) => [k, t(key)]));
  const body = t(p.key, { name: row.name.split(" ")[0], ...p.vars, ...translated });
  return deliver(db, { toPhone: row.phone, channel: p.channel ?? "whatsapp", template: p.template, body, lang: row.lang });
}
