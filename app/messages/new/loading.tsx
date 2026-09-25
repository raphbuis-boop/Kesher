import { Bone, HeaderSkeleton, SkeletonPage } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="composer">
      <HeaderSkeleton actions={0} maxWidth="max-w-2xl" />
      <div className="mx-auto max-w-2xl px-6 py-6">
        <div className="rounded-xl border border-border bg-surface">
          {["w-full", "w-48", "w-full"].map((w, i) => (
            <div key={i} className="flex items-start gap-4 border-b border-border-subtle px-6 py-5 last:border-b-0">
              <Bone className="mt-1 h-2.5 w-16" />
              <div className="flex-1 space-y-3">
                <Bone className={`h-9 rounded-lg ${w}`} />
                {i === 2 && <Bone className="h-40 w-full rounded-lg" />}
              </div>
            </div>
          ))}
          <div className="flex justify-end px-6 py-4">
            <Bone className="h-8 w-28 rounded-md" />
          </div>
        </div>
      </div>
    </SkeletonPage>
  );
}
