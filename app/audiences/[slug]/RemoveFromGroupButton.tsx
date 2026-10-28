"use client";

import { useTransition } from "react";
import { removeContactFromGroup } from "@/app/groups/actions";
import { toast } from "@/app/components/ui/toast";
import { Spinner } from "@/app/components/ui/Spinner";

/** Row "Remove" action: spinner + disabled while it runs, toast when done. */
export function RemoveFromGroupButton({ groupId, personId, name }: { groupId: string; personId: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      aria-label={`Remove ${name} from this audience`}
      onClick={() =>
        startTransition(async () => {
          try {
            await removeContactFromGroup(groupId, personId, new FormData());
            toast.success(`Removed ${name}`);
          } catch {
            toast.error(`Couldn't remove ${name}. Please try again.`);
          }
        })
      }
      className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-ink-3 transition-all hover:bg-red-50 hover:text-red-600 focus:opacity-100 disabled:opacity-100 ${isPending ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
    >
      {isPending && <Spinner size={10} />}
      {isPending ? "Removing…" : "Remove"}
    </button>
  );
}
