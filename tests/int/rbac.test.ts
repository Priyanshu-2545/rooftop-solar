import { describe, expect, it } from "vitest";
import { assertSales, canViewLead, canViewProject, canViewQuote, ForbiddenError, isAdmin } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";

const u = (over: Partial<SessionUser>): SessionUser => ({
  id: "u1", phone: "+919000000001", name: "A", role: "homeowner", isAdmin: false, language: "en", ...over,
});
const home1 = u({ id: "h1" });
const home2 = u({ id: "h2" });
const sales = u({ id: "s1", role: "sales" });
const lead = { ownerUserId: "h1" };

describe("RBAC (IDOR)", () => {
  it("homeowner can read own lead but NOT another homeowner's", () => {
    expect(canViewLead(home1, lead)).toBe(true);
    expect(canViewLead(home2, lead)).toBe(false);
  });
  it("sales can read any lead; anonymous cannot", () => {
    expect(canViewLead(sales, lead)).toBe(true);
    expect(canViewLead(null, lead)).toBe(false);
  });
  it("homeowner sees own quote only once sent/accepted", () => {
    expect(canViewQuote(home1, lead, { status: "draft" })).toBe(false);
    expect(canViewQuote(home1, lead, { status: "sent" })).toBe(true);
    expect(canViewQuote(home1, lead, { status: "accepted" })).toBe(true);
  });
  it("homeowner cannot see another's sent quote or project", () => {
    expect(canViewQuote(home2, lead, { status: "sent" })).toBe(false);
    expect(canViewProject(home2, lead)).toBe(false);
    expect(canViewProject(home1, lead)).toBe(true);
  });
  it("sales sees drafts", () => expect(canViewQuote(sales, lead, { status: "draft" })).toBe(true));
  it("assertSales throws for homeowners", () => {
    expect(() => assertSales(home1)).toThrow(ForbiddenError);
    expect(() => assertSales(null)).toThrow(ForbiddenError);
    expect(() => assertSales(sales)).not.toThrow();
  });
  it("only sales with the admin flag are admins", () => {
    expect(isAdmin(sales)).toBe(false);
    expect(isAdmin(u({ role: "sales", isAdmin: true }))).toBe(true);
    expect(isAdmin(u({ role: "homeowner", isAdmin: true }))).toBe(false);
  });
});
