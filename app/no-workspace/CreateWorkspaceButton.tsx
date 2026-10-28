"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPersonalWorkspace } from "@/app/invite/actions";
import { toast } from "@/app/components/ui/toast";
import { Spinner } from "@/app/components/ui/Spinner";

export function CreateWorkspaceButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await createPersonalWorkspace();
          if (res.ok) {
            toast.success("Your school workspace is ready");
            router.push("/settings#school");
            router.refresh();
          } else toast.error(res.error);
        })
      }
      className="btn btn-primary btn-lg w-full"
    >
      {isPending && <Spinner />}
      {isPending ? "Creating…" : "Create my own school workspace"}
    </button>
  );
}
