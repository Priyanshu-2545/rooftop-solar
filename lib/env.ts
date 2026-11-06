import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  DEMO_MODE: z.enum(["true", "false"]).default("false"),
  DEMO_OTP: z.string().regex(/^\d{6}$/).default("123456"),
  APP_ORIGIN: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof schema>;
let cached: Env | undefined;

/** Validated env, read lazily so `next build` without secrets still works. */
export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}
export const isDemo = () => env().DEMO_MODE === "true";
