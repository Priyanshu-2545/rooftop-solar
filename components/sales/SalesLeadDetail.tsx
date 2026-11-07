import type { LeadRow } from "@/lib/data/leads";
import type { SessionUser } from "@/lib/auth/session";

// Placeholder replaced in the sales-inbox step.
export function SalesLeadDetail({ lead }: { lead: LeadRow; user: SessionUser }) {
  return <h1 className="display text-3xl">{lead.humanId}</h1>;
}
