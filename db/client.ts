import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

export function createDb(url: string) {
  return drizzle(postgres(url, { max: 5, prepare: false }), { schema });
}
export type Db = ReturnType<typeof createDb>;

// One pool per server instance (kept on globalThis so dev hot reloads don't leak connections).
const g = globalThis as unknown as { __db?: Db };
export function getDb(): Db {
  g.__db ??= createDb(env().DATABASE_URL);
  return g.__db;
}
