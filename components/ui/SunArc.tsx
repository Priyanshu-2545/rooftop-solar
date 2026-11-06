import { ARC, arcPath, sunPoint } from "@/lib/ui/arc";

/**
 * The signature motif. Used ONLY for: lead-form progress, project stage timeline, quote hero.
 * The sun's position means progress (0..1). `label` is the accessible description.
 */
export function SunArc({ progress, label, className = "" }: { progress: number; label: string; className?: string }) {
  const sun = sunPoint(progress);
  return (
    <svg
      viewBox={`0 0 ${ARC.w} ${ARC.h}`}
      role="img"
      aria-label={label}
      className={`block w-full ${className}`}
      fill="none"
    >
      <path d={arcPath()} stroke="var(--hairline)" strokeWidth="2" strokeLinecap="round" />
      <path
        d={arcPath()}
        stroke="var(--ink)"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={`${Math.min(Math.max(progress, 0), 1)} 1`}
      />
      <line x1="2" y1="72" x2="198" y2="72" stroke="var(--hairline)" strokeWidth="1.5" />
      <circle cx={sun.x} cy={sun.y} r="7" fill="var(--accent)" />
    </svg>
  );
}
