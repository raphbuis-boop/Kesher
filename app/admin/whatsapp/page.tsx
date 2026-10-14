"use client";

import { useEffect, useState } from "react";

const ENDPOINT = "/api/admin/whatsapp-diagnostics";

async function fetchDiagnostics(): Promise<string> {
  try {
    const res = await fetch(ENDPOINT, { cache: "no-store" });
    return JSON.stringify(await res.json(), null, 2);
  } catch (err) {
    return `Request failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export default function WhatsAppDiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<string>("Loading…");
  const [subscribeResult, setSubscribeResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setDiagnostics("Loading…");
    setDiagnostics(await fetchDiagnostics());
  }

  async function subscribe() {
    setBusy(true);
    setSubscribeResult("Subscribing…");
    try {
      const res = await fetch(ENDPOINT, { method: "POST" });
      setSubscribeResult(JSON.stringify(await res.json(), null, 2));
      await load();
    } catch (err) {
      setSubscribeResult(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    fetchDiagnostics().then(setDiagnostics);
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-[18px] font-semibold text-[#0f0f0f]">WhatsApp diagnostics</h1>
      <div className="mt-4 flex gap-2">
        <button
          onClick={load}
          className="rounded-lg border border-[#e4e4e7] px-3 py-1.5 text-[13px] font-medium text-[#0f0f0f] hover:bg-[#fafafa]"
        >
          Refresh
        </button>
        <button
          onClick={subscribe}
          disabled={busy}
          className="rounded-lg bg-[#0f0f0f] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
        >
          Subscribe app to WABA
        </button>
      </div>
      {subscribeResult && (
        <>
          <h2 className="mt-6 text-[13px] font-semibold text-[#0f0f0f]">Subscribe result</h2>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-[#fafafa] p-4 text-[12px]">{subscribeResult}</pre>
        </>
      )}
      <h2 className="mt-6 text-[13px] font-semibold text-[#0f0f0f]">Diagnostics</h2>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-[#fafafa] p-4 text-[12px]">{diagnostics}</pre>
    </div>
  );
}
