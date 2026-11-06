// Effective-dated settings (units_per_kw_year, tariff...). Pure.
export interface SettingRow {
  key: string;
  value: string;
  effectiveFrom: Date;
}

/** Latest row for `key` whose effectiveFrom <= on. Returns undefined if none. */
export function pickSetting(rows: readonly SettingRow[], key: string, on: Date): string | undefined {
  let best: SettingRow | undefined;
  for (const r of rows) {
    if (r.key !== key || r.effectiveFrom.getTime() > on.getTime()) continue;
    if (!best || r.effectiveFrom.getTime() > best.effectiveFrom.getTime()) best = r;
  }
  return best?.value;
}

export interface QuoteSettings {
  unitsPerKwYear: number; // A6
  tariffPaisePerUnit: number; // A7
  escalationBp: number; // A8
}

export const DEFAULT_SETTINGS: QuoteSettings = { unitsPerKwYear: 1400, tariffPaisePerUnit: 800, escalationBp: 0 };

export function resolveSettings(rows: readonly SettingRow[], on: Date): QuoteSettings {
  const num = (key: string, fallback: number) => {
    const v = pickSetting(rows, key, on);
    const n = v === undefined ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    unitsPerKwYear: num("units_per_kw_year", DEFAULT_SETTINGS.unitsPerKwYear),
    tariffPaisePerUnit: num("tariff_rate_paise_per_unit", DEFAULT_SETTINGS.tariffPaisePerUnit),
    escalationBp: num("tariff_escalation_bp", DEFAULT_SETTINGS.escalationBp),
  };
}
