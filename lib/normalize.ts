// Postel's law: liberal in what we accept, strict in what we store.
const DEVANAGARI_ZERO = 0x0966;

/** Devanagari digits (०-९) -> ASCII. */
export function toAsciiDigits(s: string): string {
  return s.replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - DEVANAGARI_ZERO));
}

/** "+91 90000-00001", "९०००००००००१" -> "+919000000001". Returns null if not a valid Indian mobile. */
export function normalizePhone(input: string): string | null {
  const digits = toAsciiDigits(input).replace(/[^\d]/g, "");
  const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2)
    : digits.length === 11 && digits.startsWith("0") ? digits.slice(1)
    : digits;
  return /^[6-9]\d{9}$/.test(ten) ? `+91${ten}` : null;
}

/** "₹3,200", "3200.50", "३२००" -> number, or null. */
export function parseNumber(input: string): number | null {
  const cleaned = toAsciiDigits(input).replace(/[₹,\s]/g, "").replace(/^rs\.?/i, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** Consumer number: strip spaces/dashes, Devanagari digits ok. */
export function normalizeConsumerNo(input: string): string {
  return toAsciiDigits(input).replace(/[\s-]/g, "");
}

export const SQM_TO_SQFT = 10.7639;
export function sqmToSqft(sqm: number): number {
  return Math.round(sqm * SQM_TO_SQFT);
}

export const isPincode = (s: string) => /^\d{6}$/.test(toAsciiDigits(s).trim());
/** A13: soft hint only, never blocks. */
export const looksLikeVidarbha = (pin: string) => /^44[0-5]\d{3}$/.test(pin);
