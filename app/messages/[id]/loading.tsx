import { Bone, LoadingAnnouncement, SkeletonHeader, SkeletonList, SkeletonStatCards, SkeletonTable } from "@/app/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <LoadingAnnouncement label="campaign" />
      <SkeletonHeader wide />
      <div className="px-6 py-6 space-y-5 max-w-7xl">
        <SkeletonStatCards />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3 rounded-xl border border-line bg-card shadow-card p-5">
            <Bone className="h-3 w-32 mb-6" />
            <Bone className="h-48 w-full rounded-lg" />
          </div>
          <div className="lg:col-span-2">
            <SkeletonList rows={5} />
          </div>
        </div>
        <SkeletonTable rows={6} cols={6} />
      </div>
    </div>
  );
}
