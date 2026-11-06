import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

// One connection pool per server instance (reused across hot reloads in dev).
const g = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };
const sql = g.__sql ?? postgres(env().DATABASE_URL, { max: 5, prepare: false });
if (process.env.NODE_ENV !== "production") g.__sql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
