"use client";

import { useState } from "react";
import { HEBCAL_ATTRIBUTION, HEBCAL_URL } from "@/lib/hebcal";
import { Panel, Pill, FieldLabel, inputCls, useAction } from "./ui";
import { refreshShabbosTimes, saveShabbosSettings } from "../shabbosActions";

export type ShabbosView = {
  enabled: boolean;
  location: string;
  locationName: string | null;
  israelSchedule: boolean;
  candleMinutes: number;
  havdalahMode: "minutes" | "tzeis";
  havdalahMinutes: number;
  bufferMinutes: number;
  fetchedAt: string | null;
  fetchError: string | null;
  upcoming: { label: string; candles: string; havdalah: string; resumes: string }[];
  overrides: { when: string; reason: string }[];
  isOwner: boolean;
};

export function ShabbosSettings({ view }: { view: ShabbosView }) {
  const [enabled, setEnabled] = useState(view.enabled);
  const [location, setLocation] = useState(view.location);
  const [israel, setIsrael] = useState(view.israelSchedule);
  const [candle, setCandle] = useState(view.candleMinutes);
  const [mode, setMode] = useState(view.havdalahMode);
  const [havMin, setHavMin] = useState(view.havdalahMinutes);
  const [buffer, setBuffer] = useState(view.bufferMinutes);
  const { pending, run } = useAction();
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <div className="space-y-5">
      <Panel
        title="Shabbos & Yom Tov mode"
        description="When this is on, Kesher doesn't send anything between candle lighting and the end of Havdalah, so no message reaches a family on Shabbos or Yom Tov. Messages you schedule for that time wait and go out afterwards."
        footer={
          <button
            type="button"
            disabled={pending}
            className="btn btn-primary"
            onClick={() =>
              run(
                () => saveShabbosSettings({ enabled, location, israelSchedule: israel, candleMinutes: candle, havdalahMode: mode, havdalahMinutes: havMin, bufferMinutes: buffer }),
                "Saved"
              )
            }
          >
            Save
          </button>
        }
      >
        <div className="space-y-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line accent-[var(--ink)]" />
            <span>
              <span className="block text-[13px] font-medium text-ink">Pause sending on Shabbos and Yom Tov</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-3">
                Off by default. Texts, emails and WhatsApp messages are all held. The school owner can still send a real emergency message, with a typed reason that is recorded.
              </span>
            </span>
          </label>

          <div className={enabled ? "space-y-5" : "pointer-events-none space-y-5 opacity-50"}>
            <FieldLabel
              label="School location"
              hint={
                <>
                  A US ZIP code (like 11230), or for anywhere else a Hebcal location number: search your city at{" "}
                  <a href={`${HEBCAL_URL}/shabbat`} target="_blank" rel="noreferrer" className="underline">hebcal.com/shabbat</a>, and use the number after <code>geonameid=</code> in the page address.
                </>
              }
            >
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="11230" className={inputCls} inputMode="numeric" />
            </FieldLabel>
            {view.locationName && <p className="-mt-3 text-[12px] text-ink-2">Using times for <span className="font-medium text-ink">{view.locationName}</span>.</p>}
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-2">
              <input type="checkbox" checked={israel} onChange={(e) => setIsrael(e.target.checked)} className="h-4 w-4 rounded border-line accent-[var(--ink)]" />
              Use the Israel holiday schedule (one day of Yom Tov instead of two)
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <FieldLabel label="Candle lighting" hint="Minutes before sunset. Most communities use 18; Jerusalem uses 40.">
                <input type="number" min={0} max={90} value={candle} onChange={(e) => setCandle(num(e.target.value))} className={inputCls} />
              </FieldLabel>
              <FieldLabel label="Sending resumes" hint="Minutes after Havdalah, as a buffer.">
                <input type="number" min={0} max={240} value={buffer} onChange={(e) => setBuffer(num(e.target.value))} className={inputCls} />
              </FieldLabel>
            </div>

            <div>
              <p className="mb-1.5 text-[12px] font-medium text-ink-soft">Havdalah is</p>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
                  <input type="radio" name="havdalah" checked={mode === "minutes"} onChange={() => setMode("minutes")} className="accent-[var(--ink)]" />
                  <input type="number" min={20} max={120} value={havMin} onChange={(e) => setHavMin(num(e.target.value))} disabled={mode !== "minutes"} className={`${inputCls} !w-20`} />
                  minutes after sunset
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
                  <input type="radio" name="havdalah" checked={mode === "tzeis"} onChange={() => setMode("tzeis")} className="accent-[var(--ink)]" />
                  Nightfall (tzeis, 8.5° below the horizon)
                </label>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {view.enabled && (
        <Panel
          title="Upcoming times"
          description={
            <span className="flex flex-wrap items-center gap-2">
              {view.fetchError ? <Pill tone="bad">Couldn&apos;t load times</Pill> : view.fetchedAt ? <Pill tone="ok">Up to date</Pill> : <Pill tone="warn">Not loaded yet</Pill>}
              {view.fetchedAt && <span>Refreshed {new Date(view.fetchedAt).toLocaleDateString()}</span>}
              {view.fetchError && <span className="text-red-600">{view.fetchError}</span>}
            </span>
          }
          footer={
            <button type="button" disabled={pending} onClick={() => run(() => refreshShabbosTimes(), "Refreshed")} className="btn btn-secondary">
              Refresh now
            </button>
          }
        >
          {view.upcoming.length === 0 ? (
            <p className="text-[12px] text-ink-3">No times loaded. Check the location above and save.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-ink-3">
                  <th className="pb-2 font-semibold">When</th>
                  <th className="pb-2 font-semibold">Candle lighting</th>
                  <th className="pb-2 font-semibold">Havdalah</th>
                  <th className="pb-2 font-semibold">Sending resumes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted text-ink">
                {view.upcoming.map((w) => (
                  <tr key={w.candles}>
                    <td className="py-2 pr-3" dir="auto">{w.label}</td>
                    <td className="py-2 pr-3">{w.candles}</td>
                    <td className="py-2 pr-3">{w.havdalah}</td>
                    <td className="py-2 text-ink-2">{w.resumes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-4 text-[11px] text-ink-3">
            {HEBCAL_ATTRIBUTION}. <a href={HEBCAL_URL} target="_blank" rel="noreferrer" className="underline">hebcal.com</a>
          </p>
        </Panel>
      )}

      {view.overrides.length > 0 && (
        <Panel title="Emergency sends" description="Messages the owner sent during Shabbos or Yom Tov. Each one is recorded with the reason given.">
          <ul className="divide-y divide-muted text-[12px]">
            {view.overrides.map((o, i) => (
              <li key={i} className="flex justify-between gap-3 py-2"><span className="text-ink" dir="auto">{o.reason}</span><span className="shrink-0 text-ink-3">{o.when}</span></li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
