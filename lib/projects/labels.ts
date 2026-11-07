import type { Locale } from "@/lib/i18n/make-t";

export type StageRow = {
  code: string; order: number; stuckAfterDays: number | null;
  labelEn: string; labelMr: string; labelHi: string; nextEn: string; nextMr: string; nextHi: string;
};
export const stageLabel = (s: StageRow, l: Locale) => (l === "mr" ? s.labelMr : l === "hi" ? s.labelHi : s.labelEn);
export const stageNext = (s: StageRow, l: Locale) => (l === "mr" ? s.nextMr : l === "hi" ? s.nextHi : s.nextEn);
