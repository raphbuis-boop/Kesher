import { Bone, HeaderSkeleton, ListCardSkeleton, SkeletonPage } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="contact">
      <HeaderSkeleton back maxWidth="max-w-3xl" />
      <div className="mx-auto max-w-3xl px-6 py-6 space-y-4">
        <div className="rounded-xl border border-border bg-surface px-5 py-5">
          <div className="flex items-start gap-4">
            <Bone className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Bone className="h-5 w-48" />
              <Bone className="h-2.5 w-28" />
              <div className="flex gap-1.5 pt-1">
                <Bone className="h-5 w-16 rounded-full" />
                <Bone className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface px-5 py-5">
          <Bone className="h-3.5 w-36" />
          <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-5">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Bone className="h-2.5 w-16" />
                <Bone className="h-3 w-40" />
              </div>
            ))}
          </div>
        </div>
        <ListCardSkeleton rows={4} />
      </div>
    </SkeletonPage>
  );
}
