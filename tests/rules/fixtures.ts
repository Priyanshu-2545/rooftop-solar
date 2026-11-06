import type { SubsidyRule } from "@/lib/rules/subsidy";

export const d = (s: string) => new Date(`${s}T00:00:00Z`);

// Client-stated scheme (UNVERIFIED, ASSUMPTION A1): 30,000/kW up to 2 kW + 18,000 for 3rd, cap 78,000.
export const residentialRule: SubsidyRule = {
  id: "sub-res-2024",
  customerType: "residential",
  perKwPaise: 3_000_000,
  firstKwLimit: 2,
  extraKwPaise: 1_800_000,
  capPaise: 7_800_000,
  effectiveFrom: d("2024-01-01"),
  effectiveTo: null,
};
