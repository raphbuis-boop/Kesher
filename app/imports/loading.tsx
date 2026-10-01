import { Bone, LoadingAnnouncement, SkeletonHeader, SkeletonTable } from "@/app/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <LoadingAnnouncement label="imports" />
      <SkeletonHeader action={false} />
      <div className="px-6 py-6 max-w-2xl space-y-8">
        <div className="space-y-3">
          <Bone className="h-3 w-20" />
          <Bone className="h-44 w-full rounded-xl" />
        </div>
        <div className="space-y-3">
          <Bone className="h-3 w-24" />
          <SkeletonTable rows={4} cols={4} />
        </div>
      </div>
    </div>
  );
}
