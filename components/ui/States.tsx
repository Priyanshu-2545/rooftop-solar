import { LinkButton } from "./Button";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="border-b border-hairline pb-4">
          <Skeleton className="mb-2 h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, body, actionHref, actionLabel }: { title: string; body?: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="border-t border-hairline py-10">
      <h2 className="display text-2xl">{title}</h2>
      {body ? <p className="mt-2 text-muted">{body}</p> : null}
      {actionHref && actionLabel ? <div className="mt-6"><LinkButton href={actionHref}>{actionLabel}</LinkButton></div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: React.ReactNode }) {
  return (
    <div role="alert" className="border-l-4 border-warn bg-surface p-4">
      <p className="font-semibold">{message}</p>
      {onRetry ? <div className="mt-3">{onRetry}</div> : null}
    </div>
  );
}
