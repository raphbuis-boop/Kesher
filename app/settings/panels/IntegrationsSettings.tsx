"use client";

import { Check, Plug } from "lucide-react";
import { Spinner } from "@/app/components/ui/Spinner";
import type { ProviderInfo } from "@/lib/sync/connectors";
import { cancelIntegrationRequest, requestIntegration } from "../integrationActions";
import { Panel, Pill, useAction } from "./ui";

/** FACTS / Veracross / Blackbaud: "Coming soon — request integration". */
export function IntegrationsSettings({ providers, requested }: { providers: ProviderInfo[]; requested: string[] }) {
  const { pending, run } = useAction();
  return (
    <Panel
      title="School systems"
      description="Connect the system where your families already live, so nobody is entered twice. Tell us which one you use and we'll prioritize it."
    >
      <ul className="divide-y divide-line">
        {providers.map((p) => {
          const asked = requested.includes(p.kind);
          return (
            <li key={p.kind} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Plug size={14} className="shrink-0 text-ink-3" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">{p.label}</p>
                <p className="text-[11px] text-ink-3">{p.blurb}</p>
              </div>
              <Pill tone="muted">Coming soon</Pill>
              {asked ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(async () => { const r = await cancelIntegrationRequest(p.kind); return r.ok ? { ok: true as const } : r; }, "Request withdrawn")}
                  className="btn btn-ghost btn-sm"
                  title="Click to withdraw your request"
                >
                  <Check size={11} strokeWidth={2.5} className="text-emerald-600" /> Requested
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(async () => { const r = await requestIntegration(p.kind); return r.ok ? { ok: true as const } : r; }, `Thanks — we've noted that you want ${p.label}`)}
                  className="btn btn-secondary btn-sm"
                >
                  {pending && <Spinner size={10} />} Request integration
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[11px] text-ink-3">
        Until then, upload an export on the <a href="/imports" className="underline underline-offset-2 hover:text-ink">Imports</a> page or connect a Google Sheet — both update automatically the next time you upload or sync.
      </p>
    </Panel>
  );
}
