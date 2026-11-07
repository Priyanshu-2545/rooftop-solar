import { ListSkeleton, Skeleton } from "@/components/ui/States";

// Skeletons, not spinners (Doherty): the layout appears instantly while data loads.
export default function Loading() {
  return (
    <section aria-busy="true">
      <Skeleton className="mb-6 h-10 w-2/3" />
      <ListSkeleton rows={4} />
    </section>
  );
}
