// Sun-arc geometry. The sun sits at progress t (0..1) along a quadratic arc. Pure, unit-tested.
export const ARC = { w: 200, h: 80, p0: [8, 72], p1: [100, -16], p2: [192, 72] } as const;

export function arcPath(): string {
  const { p0, p1, p2 } = ARC;
  return `M${p0[0]} ${p0[1]} Q${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`;
}

export function sunPoint(t: number): { x: number; y: number } {
  const c = Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), 1);
  const { p0, p1, p2 } = ARC;
  const u = 1 - c;
  return {
    x: Math.round((u * u * p0[0] + 2 * u * c * p1[0] + c * c * p2[0]) * 10) / 10,
    y: Math.round((u * u * p0[1] + 2 * u * c * p1[1] + c * c * p2[1]) * 10) / 10,
  };
}
