"use client";

import { useState } from "react";
import Link from "next/link";
import { setNewContactsMode } from "@/app/imports/syncActions";
import { Panel, useAction } from "./ui";

/** Org setting: new people from a sync are added directly or held for review. */
export function NewContactsSetting({ mode, pending }: { mode: "review" | "auto"; pending: number }) {
  const [value, setValue] = useState(mode);
  const { pending: saving, run } = useAction();
  const options = [
    { v: "review" as const, title: "Review first (recommended)", body: "New people wait in Review new contacts. Nobody new gets messages until an admin approves them." },
    { v: "auto" as const, title: "Add automatically", body: "New people from your lists are added and start getting messages right away." },
  ];
  return (
    <Panel
      title="New contacts"
      description="What happens when an import, Google Sheet or school system sync finds someone Kesher hasn't seen before."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            disabled={saving}
            onClick={() => {
              setValue(o.v);
              run(() => setNewContactsMode(o.v), "Saved");
            }}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${value === o.v ? "border-ink bg-card shadow-card" : "border-line bg-canvas hover:border-line-strong"}`}
          >
            <p className="text-[13px] font-medium text-ink">{o.title}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{o.body}</p>
          </button>
        ))}
      </div>
      {pending > 0 && (
        <Link href="/people/review" className="mt-3 inline-flex text-[12px] font-medium text-brand hover:underline">
          {pending} {pending === 1 ? "person is" : "people are"} waiting for review →
        </Link>
      )}
    </Panel>
  );
}
