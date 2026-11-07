import { ListSkeleton, Skeleton } from "@/components/ui/States";

export default function Loading() {
  return (
    <section>
      <Skeleton className="mb-6 h-10 w-40" />
      <Skeleton className="mb-6 h-12 w-full" />
      <ListSkeleton rows={8} />
    </section>
  );
}
