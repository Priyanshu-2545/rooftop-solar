import { describe, expect, it } from "vitest";
import { canMoveForward, daysInStage, isStuck, progressOf, splitTimeline } from "@/lib/projects/stuck";

const stages = [
  { code: "a", order: 1, stuckAfterDays: 3 }, { code: "b", order: 2, stuckAfterDays: 5 }, { code: "c", order: 3, stuckAfterDays: 7 },
  { code: "d", order: 4, stuckAfterDays: 7 }, { code: "e", order: 5, stuckAfterDays: 7 }, { code: "f", order: 6, stuckAfterDays: null },
];
const now = new Date("2026-11-07T10:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe("stuck projects", () => {
  it("counts whole days and never goes negative", () => {
    expect(daysInStage(ago(9), now)).toBe(9);
    expect(daysInStage(new Date(now.getTime() + 5000), now)).toBe(0);
  });
  it("is stuck only when days EXCEED the threshold", () => {
    expect(isStuck(stages[0], ago(3), now)).toBe(false);
    expect(isStuck(stages[0], ago(4), now)).toBe(true);
  });
  it("the terminal stage is never stuck; an unknown stage is not stuck", () => {
    expect(isStuck(stages[5], ago(400), now)).toBe(false);
    expect(isStuck(undefined, ago(400), now)).toBe(false);
  });
  it("sun-arc progress runs 0..1 across the stages", () => {
    expect(progressOf(stages, "a")).toBe(0);
    expect(progressOf(stages, "f")).toBe(1);
    expect(progressOf(stages, "c")).toBeCloseTo(0.4);
    expect(progressOf(stages, "zzz")).toBe(0);
    expect(progressOf([], "a")).toBe(0);
  });
  it("shows the current + next 3 stages, collapsing the rest", () => {
    const s = splitTimeline(stages, "b");
    expect(s.done.map((x) => x.code)).toEqual(["a"]);
    expect(s.visible.map((x) => x.code)).toEqual(["b", "c", "d", "e"]);
    expect(s.later.map((x) => x.code)).toEqual(["f"]);
  });
  it("only allows moving forward", () => {
    expect(canMoveForward(stages[1], stages[3])).toBe(true);
    expect(canMoveForward(stages[3], stages[1])).toBe(false);
    expect(canMoveForward(stages[1], stages[1])).toBe(false);
    expect(canMoveForward(undefined, stages[1])).toBe(false);
  });
});
