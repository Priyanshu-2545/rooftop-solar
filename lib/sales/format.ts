// Display helpers (pure). All dates shown in Asia/Kolkata (A24).
export function maskConsumerNo(n: string | null): string {
  if (!n) return "—";
  return n.length <= 4 ? "••••" : `${"•".repeat(n.length - 4)}${n.slice(-4)}`;
}
export function ageLabel(from: Date, now: Date): string {
  const mins = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}
export function formatDateIST(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(d);
}
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}
