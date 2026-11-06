// One chip style for status/score (Law of Similarity). Colour is never the only signal: text always shown.
const tone = {
  high: "border-support text-support",
  medium: "border-ink text-ink",
  low: "border-muted text-muted",
  warn: "border-warn text-warn",
  plain: "border-hairline text-muted",
} as const;

export function Chip({ kind = "plain", children }: { kind?: keyof typeof tone; children: React.ReactNode }) {
  return <span className={`inline-block rounded-md border px-2 py-0.5 text-sm font-semibold ${tone[kind]}`}>{children}</span>;
}

export function ScoreChip({ band }: { band: "high" | "medium" | "low" | null }) {
  if (!band) return <Chip>—</Chip>;
  const label = { high: "High", medium: "Medium", low: "Low" }[band];
  return <Chip kind={band}>{label}</Chip>;
}
