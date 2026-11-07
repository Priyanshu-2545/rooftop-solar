// Client-safe pieces shared by the builder UI and the server service (no db imports).
import type { OptionOutput, Tier } from "./compute";

export type Selection = { kw: number; tier: Tier };

export const ruleIdsOf = (options: OptionOutput[]): string[] =>
  [...new Set(options.flatMap((o) => [o.priceRuleId, o.subsidyRuleId].filter((x): x is string => !!x)))].sort();
