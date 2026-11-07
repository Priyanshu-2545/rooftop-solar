// Retention job (A17): delete bill photos + readings 180 days after a lead is closed or won.
// DRY RUN by default. Pass --yes to actually delete. Not scheduled: run from a cron / Vercel cron in production.
import { config } from "dotenv";
import { and, inArray, lt } from "drizzle-orm";
import { createDb } from "../db/client";
import { billExtractions, billUploads, leads } from "../db/schema";

config({ path: ".env.local" });
config();
const RETENTION_DAYS = 180;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = createDb(url);
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  const old = await db.select({ id: leads.id }).from(leads).where(and(inArray(leads.status, ["closed", "won"]), lt(leads.createdAt, cutoff)));
  const leadIds = old.map((l) => l.id);
  const uploads = leadIds.length ? await db.select({ id: billUploads.id }).from(billUploads).where(inArray(billUploads.leadId, leadIds)) : [];
  console.log(`${leadIds.length} closed/won leads older than ${RETENTION_DAYS} days; ${uploads.length} bill photos eligible.`);
  if (!process.argv.includes("--yes")) { console.log("Dry run. Re-run with --yes to delete."); process.exit(0); }
  if (uploads.length) {
    const ids = uploads.map((u) => u.id);
    await db.delete(billExtractions).where(inArray(billExtractions.uploadId, ids));
    await db.delete(billUploads).where(inArray(billUploads.id, ids));
  }
  console.log(`Deleted ${uploads.length} bill photos and their readings.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
