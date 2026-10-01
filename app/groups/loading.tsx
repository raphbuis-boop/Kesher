import { LoadingAnnouncement, SkeletonHeader, SkeletonList } from "@/app/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <LoadingAnnouncement label="audiences" />
      <SkeletonHeader wide />
      <div className="px-6 py-4">
        <SkeletonList rows={6} />
      </div>
    </div>
  );
}
