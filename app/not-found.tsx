import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <section className="py-8">
      <h1 className="display mb-3 text-3xl">We could not find that page</h1>
      <p className="mb-6 text-muted">It may have moved, or it may not be yours to see.</p>
      <LinkButton href="/">Go home</LinkButton>
    </section>
  );
}
