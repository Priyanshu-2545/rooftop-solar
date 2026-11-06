import { describe, expect, it } from "vitest";
import { arcPath, sunPoint } from "@/lib/ui/arc";
import { contrast } from "@/lib/ui/contrast";

describe("sun arc", () => {
  it("starts on the left horizon and ends on the right", () => {
    expect(sunPoint(0)).toEqual({ x: 8, y: 72 });
    expect(sunPoint(1)).toEqual({ x: 192, y: 72 });
  });
  it("is highest at the midpoint", () => {
    const mid = sunPoint(0.5);
    expect(mid.x).toBe(100);
    expect(mid.y).toBeLessThan(sunPoint(0.2).y);
  });
  it("clamps bad progress", () => {
    expect(sunPoint(-3)).toEqual(sunPoint(0));
    expect(sunPoint(9)).toEqual(sunPoint(1));
    expect(sunPoint(NaN)).toEqual(sunPoint(0));
  });
  it("renders a single path", () => expect(arcPath().startsWith("M8 72 Q")).toBe(true));
});

describe("palette contrast (WCAG AA)", () => {
  const P = { paper: "#F6F1E7", surface: "#FFFDF8", ink: "#1E2430", muted: "#5B6270", accent: "#C9741B", support: "#1F5C58", warn: "#B4482E" };
  it.each([
    ["ink", "paper"], ["ink", "surface"], ["muted", "paper"], ["muted", "surface"],
    ["support", "paper"], ["support", "surface"], ["warn", "paper"], ["warn", "surface"],
  ] as const)("%s on %s >= 4.5:1", (fg, bg) => {
    expect(contrast(P[fg], P[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it("white on saffron passes only as LARGE text (>= 3:1), so primary labels are 19px bold", () => {
    const r = contrast("#FFFFFF", P.accent);
    expect(r).toBeGreaterThanOrEqual(3);
    expect(r).toBeLessThan(4.5);
  });
  it("saffron sun on paper passes the 3:1 non-text rule", () => {
    expect(contrast(P.accent, P.paper)).toBeGreaterThanOrEqual(3);
  });
});
