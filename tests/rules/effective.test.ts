import { describe, expect, it } from "vitest";
import {
  NoEffectiveRuleError,
  RuleGapError,
  RuleOverlapError,
  selectEffectiveRule,
} from "@/lib/rules/effective";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const row = (id: string, from: string, to: string | null) => ({
  id,
  effectiveFrom: d(from),
  effectiveTo: to ? d(to) : null,
});

describe("selectEffectiveRule", () => {
  const rows = [row("old", "2024-01-01", "2025-04-01"), row("new", "2025-04-01", null)];

  it("picks the open-ended row for a later date", () => {
    expect(selectEffectiveRule(rows, d("2026-11-06")).id).toBe("new");
  });
  it("start is inclusive: the boundary day belongs to the new row", () => {
    expect(selectEffectiveRule(rows, d("2025-04-01")).id).toBe("new");
  });
  it("end is exclusive: the day before still uses the old row", () => {
    expect(selectEffectiveRule(rows, d("2025-03-31")).id).toBe("old");
  });
  it("is order independent (deterministic)", () => {
    expect(selectEffectiveRule([...rows].reverse(), d("2024-06-01")).id).toBe("old");
  });
  it("throws when the date is before every rule", () => {
    expect(() => selectEffectiveRule(rows, d("2023-12-31"))).toThrow(NoEffectiveRuleError);
  });
  it("throws when a closed last row has expired", () => {
    expect(() => selectEffectiveRule([row("a", "2024-01-01", "2025-01-01")], d("2025-01-01"))).toThrow(
      NoEffectiveRuleError,
    );
  });
  it("throws on overlap", () => {
    expect(() =>
      selectEffectiveRule([row("a", "2024-01-01", "2025-06-01"), row("b", "2025-01-01", null)], d("2025-02-01")),
    ).toThrow(RuleOverlapError);
  });
  it("throws when an open-ended row is followed by another", () => {
    expect(() =>
      selectEffectiveRule([row("a", "2024-01-01", null), row("b", "2025-01-01", null)], d("2025-02-01")),
    ).toThrow(RuleOverlapError);
  });
  it("throws on a gap", () => {
    expect(() =>
      selectEffectiveRule([row("a", "2024-01-01", "2024-06-01"), row("b", "2024-07-01", null)], d("2024-08-01")),
    ).toThrow(RuleGapError);
  });
  it("throws on an inverted row", () => {
    expect(() => selectEffectiveRule([row("a", "2025-01-01", "2024-01-01")], d("2025-02-01"))).toThrow(
      RuleOverlapError,
    );
  });
});
