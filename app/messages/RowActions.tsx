"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/app/components/ui/toast";
import { Spinner } from "@/app/components/ui/Spinner";
import { approveMessage, cancelMessage, deleteRecurring, deleteUnsentMessage, rejectMessage, setRecurringActive, type ActionResult } from "./actions";

type Kind = "draft" | "scheduled" | "approval";

/** Per-row buttons on the Drafts / Scheduled / Needs approval tabs. */
export function MessageRowActions({ id, kind, isAdmin }: { id: string; kind: Kind; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const run = (fn: () => Promise<ActionResult>, done: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? done);
        setRejecting(false);
        router.refresh();
      } else toast.error(res.error);
    });

  if (rejecting) {
    return (
      <form
        className="flex items-center justify-end gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => rejectMessage(id, reason), "Sent back");
        }}
      >
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="w-44 rounded-md border border-line bg-canvas px-2 py-1 text-[12px] text-ink outline-none focus:border-ink-3"
          autoFocus
        />
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? <Spinner size={10} /> : "Send back"}</button>
        <button type="button" onClick={() => setRejecting(false)} className="btn btn-ghost btn-sm">Cancel</button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {kind === "approval" && isAdmin && (
        <button type="button" disabled={pending} onClick={() => run(() => approveMessage(id), "Approved")} className="btn btn-primary btn-sm">
          {pending ? <Spinner size={10} /> : "Approve"}
        </button>
      )}
      {(kind !== "scheduled" || isAdmin) && (
        <Link href={`/messages/new?edit=${id}`} className="btn btn-secondary btn-sm">{kind === "approval" && isAdmin ? "Review" : "Edit"}</Link>
      )}
      {kind === "approval" && isAdmin && (
        <button type="button" disabled={pending} onClick={() => setRejecting(true)} className="btn btn-ghost btn-sm">Reject</button>
      )}
      {kind === "draft" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => confirm("Delete this draft?") && run(() => deleteUnsentMessage(id), "Deleted")}
          className="btn btn-ghost btn-sm"
        >
          Delete
        </button>
      )}
      {(kind === "scheduled" || (kind === "approval" && !isAdmin)) && (
        <button
          type="button"
          disabled={pending}
          onClick={() => confirm(kind === "scheduled" ? "Cancel this scheduled message? Nothing will be sent." : "Withdraw this request?") && run(() => cancelMessage(id), "Cancelled")}
          className="btn btn-ghost btn-sm"
        >
          {kind === "scheduled" ? "Cancel" : "Withdraw"}
        </button>
      )}
    </div>
  );
}

export function RecurringRowActions({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, done: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(done);
        router.refresh();
      } else toast.error(res.error);
    });
  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link href={`/messages/new?recurring=${id}`} className="btn btn-secondary btn-sm">Edit</Link>
      <button type="button" disabled={pending} onClick={() => run(() => setRecurringActive(id, !active), active ? "Paused" : "Resumed")} className="btn btn-ghost btn-sm">
        {pending ? <Spinner size={10} /> : active ? "Pause" : "Resume"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => confirm("Delete this repeating send? Anything already scheduled from it is cancelled; past messages stay.") && run(() => deleteRecurring(id), "Deleted")}
        className="btn btn-ghost btn-sm"
      >
        Delete
      </button>
    </div>
  );
}
