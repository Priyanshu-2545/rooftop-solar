// Stuck-project logic. Pure. Thresholds come from the project_stages table (A14, editable).
export interface StageInfo {
  code: string;
  order: number;
  stuckAfterDays: number | null;
}

export function daysInStage(enteredAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - enteredAt.getTime()) / 86_400_000));
}

/** Stuck = days in the current stage exceeds that stage's threshold. Terminal stage (null threshold) is never stuck. */
export function isStuck(stage: StageInfo | undefined, enteredAt: Date, now: Date): boolean {
  if (!stage || stage.stuckAfterDays === null) return false;
  return daysInStage(enteredAt, now) > stage.stuckAfterDays;
}

/** 0..1 for the sun-arc: first stage = 0, last = 1. */
export function progressOf(stages: readonly StageInfo[], code: string): number {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((s) => s.code === code);
  return sorted.length < 2 || i < 0 ? 0 : i / (sorted.length - 1);
}

/** Miller's law: show the current stage and the next few; collapse the rest. */
export function splitTimeline<T extends StageInfo>(stages: readonly T[], code: string, ahead = 3): { done: T[]; visible: T[]; later: T[] } {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const i = Math.max(0, sorted.findIndex((s) => s.code === code));
  return { done: sorted.slice(0, i), visible: sorted.slice(i, i + 1 + ahead), later: sorted.slice(i + 1 + ahead) };
}

export const canMoveForward = (from: StageInfo | undefined, to: StageInfo | undefined): boolean =>
  !!from && !!to && to.order > from.order;
