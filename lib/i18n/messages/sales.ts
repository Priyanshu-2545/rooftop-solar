// Sales/desk screens are English only (documented fallback, docs/I18N.md).
const en = {
  "sales.inbox": "Leads",
  "sales.projects": "Projects",
  "sales.messages": "Messages",
  "sales.rules": "Rules",
  "sales.search": "Search name or phone",
  "sales.filters": "Filters",
  "sales.score": "Score",
  "sales.status": "Status",
  "sales.pincode": "Pincode",
  "sales.all": "All",
  "sales.empty.leads": "No leads match. Clear a filter to see more.",
  "sales.stuck": "Stuck projects",
  "sales.stuck.none": "Nothing is stuck right now.",
  "sales.noStuck": "No stuck projects",
} as const;
const mr: Partial<Record<keyof typeof en, string>> = {};
const hi: Partial<Record<keyof typeof en, string>> = {};
export const sales = { en, mr, hi } as { en: Record<keyof typeof en, string>; mr: Record<string, string>; hi: Record<string, string> };
