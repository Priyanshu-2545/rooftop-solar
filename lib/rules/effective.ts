// Effective-dated rule selection. Pure.
// ASSUMPTION A3: interval is [effectiveFrom, effectiveTo): start inclusive, end exclusive.
// effectiveTo = null means open-ended.
// Callers filter rows to one "series" first (e.g. one customer type, or one kw+tier).

export interface Dated {
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export class RuleOverlapError extends Error {
  constructor(message = "Rule rows overlap in effective dates") {
    super(message);
    this.name = "RuleOverlapError";
  }
}
export class RuleGapError extends Error {
  constructor(message = "Rule rows have a gap between effective dates") {
    super(message);
    this.name = "RuleGapError";
  }
}
export class NoEffectiveRuleError extends Error {
  constructor(message = "No rule is effective on this date") {
    super(message);
    this.name = "NoEffectiveRuleError";
  }
}

const t = (d: Date): number => d.getTime();

/** Throws if any row has from >= to, rows overlap, or there is a gap between consecutive rows. */
export function validateRuleTable<T extends Dated>(rows: readonly T[]): void {
  const sorted = [...rows].sort((a, b) => t(a.effectiveFrom) - t(b.effectiveFrom));
  for (const row of sorted) {
    if (row.effectiveTo !== null && t(row.effectiveTo) <= t(row.effectiveFrom)) {
      throw new RuleOverlapError("A rule row ends on or before it starts");
    }
  }
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    if (prev.effectiveTo === null || t(next.effectiveFrom) < t(prev.effectiveTo)) {
      throw new RuleOverlapError();
    }
    if (t(next.effectiveFrom) > t(prev.effectiveTo)) throw new RuleGapError();
  }
}

/**
 * Picks the single row whose [from, to) contains `on`.
 * Deterministic. Throws on overlap/gap in the table, and NoEffectiveRuleError when nothing matches
 * (e.g. date before the first rule, or after a closed last row).
 */
export function selectEffectiveRule<T extends Dated>(rows: readonly T[], on: Date): T {
  validateRuleTable(rows);
  const match = rows.find(
    (r) => t(r.effectiveFrom) <= t(on) && (r.effectiveTo === null || t(on) < t(r.effectiveTo)),
  );
  if (!match) throw new NoEffectiveRuleError();
  return match;
}
