// Deny by default. Pure permission checks; loaders in lib/data call these on EVERY read.
import type { SessionUser } from "./session";

export class ForbiddenError extends Error {
  constructor() { super("Forbidden"); this.name = "ForbiddenError"; }
}
export const isSales = (u: SessionUser | null): boolean => u?.role === "sales";
export const isAdmin = (u: SessionUser | null): boolean => u?.role === "sales" && u.isAdmin;

export function canViewLead(u: SessionUser | null, lead: { ownerUserId: string }): boolean {
  if (!u) return false;
  return isSales(u) || lead.ownerUserId === u.id;
}
/** Homeowners only see a quote once it is sent (or accepted). */
export function canViewQuote(u: SessionUser | null, lead: { ownerUserId: string }, quote: { status: string }): boolean {
  if (!u) return false;
  if (isSales(u)) return true;
  return lead.ownerUserId === u.id && (quote.status === "sent" || quote.status === "accepted");
}
export function canViewProject(u: SessionUser | null, lead: { ownerUserId: string }): boolean {
  return canViewLead(u, lead);
}
export function assertSales(u: SessionUser | null): asserts u is SessionUser {
  if (!u || u.role !== "sales") throw new ForbiddenError();
}
