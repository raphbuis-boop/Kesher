import { Bone, LoadingAnnouncement, SkeletonHeader, SkeletonTable } from "@/app/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <LoadingAnnouncement label="audience" />
      <SkeletonHeader wide />
      <div className="border-b border-[#e7e7e7] bg-white px-6 py-3.5">
        <Bone className="h-7 w-72 rounded-lg" />
      </div>
      <div className="px-6 py-4">
        <SkeletonTable rows={10} cols={5} />
      </div>
    </div>
  );
}
