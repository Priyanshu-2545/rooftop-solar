import { config } from "dotenv";
import postgres from "postgres";

// Reset rate limits / OTP challenges so repeated local runs don't trip the (intentional) limits.
export default async function globalSetup() {
  config({ path: ".env.local" });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required for e2e");
  const sql = postgres(url, { max: 1 });
  await sql`truncate rate_limits, otp_challenges`;
  await sql.end();
}
