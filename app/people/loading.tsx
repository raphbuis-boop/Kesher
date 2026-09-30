import { Bone, LoadingAnnouncement, SkeletonHeader, SkeletonTable } from "@/app/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <LoadingAnnouncement label="people" />
      <SkeletonHeader />
      <div className="border-b border-line bg-card px-6 py-3 flex gap-2">
        {["w-12", "w-20", "w-16", "w-14", "w-16"].map((w, i) => <Bone key={i} className={`h-7 rounded-lg ${w}`} />)}
      </div>
      <div className="border-b border-line bg-card px-6 py-2.5">
        <Bone className="h-7 w-[280px] rounded-lg" />
      </div>
      <div className="px-6 py-4">
        <SkeletonTable rows={10} cols={6} />
      </div>
    </div>
  );
}
