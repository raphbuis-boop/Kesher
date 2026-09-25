import { Bone, FormCardSkeleton, HeaderSkeleton, SkeletonPage } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="settings">
      <HeaderSkeleton actions={0} />
      <div className="px-6 py-6 max-w-lg space-y-8">
        {[3, 3, 2].map((fields, i) => (
          <section key={i}>
            <Bone className="mb-3 h-2.5 w-28" />
            <FormCardSkeleton fields={fields} />
          </section>
        ))}
      </div>
    </SkeletonPage>
  );
}
