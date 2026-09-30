import { Bone, LoadingAnnouncement, SkeletonHeader, SkeletonList, SkeletonStatCards } from "@/app/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <LoadingAnnouncement label="overview" />
      <SkeletonHeader />
      <div className="px-6 py-6 space-y-6 max-w-7xl">
        <SkeletonStatCards />
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-3">
            <Bone className="h-3 w-28" />
            <SkeletonList rows={7} />
          </div>
          <div className="lg:col-span-2 space-y-3">
            <Bone className="h-3 w-24" />
            <SkeletonList rows={4} />
          </div>
        </div>
      </div>
    </div>
  );
}
