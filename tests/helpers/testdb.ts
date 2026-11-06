import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "@/db/client";

export const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:localdev@localhost:54329/solar_test";
export const testDb = createDb(TEST_URL);
let migrated = false;

/** Fresh empty schema for each test file/case. */
export async function resetDb() {
  if (!migrated) {
    await migrate(testDb, { migrationsFolder: "db/migrations" });
    migrated = true;
  }
  await testDb.execute(sql`TRUNCATE users, otp_challenges, sessions, leads, bill_uploads, bill_extractions, surveys,
    price_rules, subsidy_rules, app_settings, quotes, project_stages, projects, project_events, documents,
    messages, audit_log, payments, rate_limits RESTART IDENTITY CASCADE`);
}
