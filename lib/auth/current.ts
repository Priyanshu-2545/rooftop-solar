import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { env } from "@/lib/env";
import { SESSION_COOKIE, verifySession, type SessionUser } from "./session";

export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(getDb(), token, env().SESSION_SECRET, new Date());
}
export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/signin");
  return u;
}
export async function requireSalesUser(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "sales") redirect("/");
  return u;
}
