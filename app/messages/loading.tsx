import { Bone, LoadingAnnouncement, SkeletonHeader, SkeletonTable } from "@/app/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <LoadingAnnouncement label="messages" />
      <SkeletonHeader />
      <div className="border-b border-line bg-card px-6 flex gap-5 pt-3 pb-3">
        {["w-12", "w-14", "w-16", "w-16"].map((w, i) => <Bone key={i} className={`h-3 ${w}`} />)}
      </div>
      <div className="px-6 py-4">
        <SkeletonTable rows={8} cols={5} />
      </div>
    </div>
  );
}
