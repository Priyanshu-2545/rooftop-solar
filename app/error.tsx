"use client";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";

// Friendly error boundary: no stack traces or internals reach the user.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="py-8">
      <ErrorState message="Something went wrong on our side. Please try again." onRetry={<Button variant="secondary" onClick={reset}>Try again</Button>} />
    </section>
  );
}
