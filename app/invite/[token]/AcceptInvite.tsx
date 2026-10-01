"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite, switchAccountForInvite } from "../actions";
import { toast } from "@/app/components/ui/toast";
import { Spinner } from "@/app/components/ui/Spinner";

export function AcceptInviteButton({ token, schoolName }: { token: string; schoolName: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await acceptInvite(token);
          if (res.ok) {
            toast.success(`Welcome to ${schoolName}`);
            router.push("/dashboard");
            router.refresh();
          } else {
            toast.error(res.error);
          }
        })
      }
      className="btn btn-primary btn-lg w-full"
    >
      {isPending && <Spinner />}
      {isPending ? "Joining…" : `Join ${schoolName}`}
    </button>
  );
}

export function SwitchAccountButton({ token, email }: { token: string; email: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => switchAccountForInvite(token, email))}
      className="btn btn-secondary btn-lg w-full"
    >
      {isPending && <Spinner />}
      Sign out and continue as {email}
    </button>
  );
}
