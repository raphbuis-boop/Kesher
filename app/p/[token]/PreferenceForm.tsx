"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { savePreferences } from "./actions";

type Group = { id: string; name: string; muted: boolean };

export function PreferenceForm({
  token,
  prefs,
  hasEmail,
  hasPhone,
  stopped,
  groups,
  languages,
  smsConsent,
  whatsappConsent,
  schoolName,
}: {
  token: string;
  prefs: { email: boolean; sms: boolean; whatsapp: boolean; emergencyOnly: boolean; language: string | null };
  hasEmail: boolean;
  hasPhone: boolean;
  stopped: { email: boolean; sms: boolean; whatsapp: boolean };
  groups: Group[];
  languages: { value: string; label: string }[];
  smsConsent: string;
  whatsappConsent: string;
  schoolName: string;
}) {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState(prefs.email && hasEmail);
  const [sms, setSms] = useState(prefs.sms && hasPhone);
  const [whatsapp, setWhatsapp] = useState(prefs.whatsapp && hasPhone);
  const [emergencyOnly, setEmergencyOnly] = useState(prefs.emergencyOnly);
  const [muted, setMuted] = useState<Set<string>>(new Set(groups.filter((g) => g.muted).map((g) => g.id)));
  const [language, setLanguage] = useState(prefs.language ?? "");
  const [agreeSms, setAgreeSms] = useState(false);
  const [agreeWhatsapp, setAgreeWhatsapp] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const turningOnSms = sms && !prefs.sms;
  const turningOnWa = whatsapp && !prefs.whatsapp;

  const save = () =>
    start(async () => {
      setMessage(null);
      const res = await savePreferences(token, { email, sms, whatsapp, emergencyOnly, mutedGroupIds: [...muted], language: language || null, agreeSms, agreeWhatsapp });
      setMessage(res.ok ? { ok: true, text: "Saved. Thank you." } : { ok: false, text: res.error });
    });

  const row = "flex items-start gap-3 rounded-lg border border-line bg-card px-4 py-3";
  const box = "mt-0.5 h-4 w-4 shrink-0 accent-[var(--ink)]";

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Channels</h2>
        <label className={row}>
          <input type="checkbox" className={box} checked={email} disabled={!hasEmail || stopped.email} onChange={(e) => setEmail(e.target.checked)} />
          <span className="text-[14px] text-ink">Email{!hasEmail && <span className="block text-[12px] text-ink-3">No email address on file</span>}{stopped.email && <span className="block text-[12px] text-amber-700">You unsubscribed from email. Contact the office to start again.</span>}</span>
        </label>
        <label className={row}>
          <input type="checkbox" className={box} checked={sms} disabled={!hasPhone || stopped.sms} onChange={(e) => setSms(e.target.checked)} />
          <span className="text-[14px] text-ink">Text messages{!hasPhone && <span className="block text-[12px] text-ink-3">No mobile number on file</span>}{stopped.sms && <span className="block text-[12px] text-amber-700">You replied STOP. Reply START to the school&apos;s number, or contact the office, to start again.</span>}</span>
        </label>
        {turningOnSms && (
          <label className="ml-7 flex items-start gap-2 text-[12px] leading-relaxed text-ink-2">
            <input type="checkbox" className={box} checked={agreeSms} onChange={(e) => setAgreeSms(e.target.checked)} />
            <span>{smsConsent}</span>
          </label>
        )}
        <label className={row}>
          <input type="checkbox" className={box} checked={whatsapp} disabled={!hasPhone || stopped.whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} />
          <span className="text-[14px] text-ink">WhatsApp{stopped.whatsapp && <span className="block text-[12px] text-amber-700">You stopped WhatsApp messages. Contact the office to start again.</span>}</span>
        </label>
        {turningOnWa && (
          <label className="ml-7 flex items-start gap-2 text-[12px] leading-relaxed text-ink-2">
            <input type="checkbox" className={box} checked={agreeWhatsapp} onChange={(e) => setAgreeWhatsapp(e.target.checked)} />
            <span>{whatsappConsent}</span>
          </label>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">What you receive</h2>
        <label className={row}>
          <input type="checkbox" className={box} checked={emergencyOnly} onChange={(e) => setEmergencyOnly(e.target.checked)} />
          <span className="text-[14px] text-ink">
            Emergency messages only
            <span className="block text-[12px] leading-relaxed text-ink-3">Closures, safety alerts and urgent notices from {schoolName || "the school"}. Nothing else.</span>
          </span>
        </label>
        {!emergencyOnly && groups.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-[12px] text-ink-3">Groups you or your children are in. Untick any you don&apos;t want updates from:</p>
            {groups.map((g) => (
              <label key={g.id} className={row}>
                <input
                  type="checkbox"
                  className={box}
                  checked={!muted.has(g.id)}
                  onChange={(e) =>
                    setMuted((m) => {
                      const next = new Set(m);
                      if (e.target.checked) next.delete(g.id);
                      else next.add(g.id);
                      return next;
                    })
                  }
                />
                <span dir="auto" className="text-[14px] text-ink">{g.name}</span>
              </label>
            ))}
            <p className="text-[12px] text-ink-3">Emergency messages always reach you, whatever you untick here.</p>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Language</h2>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-[15px] text-ink outline-none focus:border-ink-3" aria-label="Preferred language">
          <option value="">No preference</option>
          {languages.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </section>

      {message && (
        <p className={"flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[14px] " + (message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700")}>
          {message.ok && <CheckCircle2 size={16} />} {message.text}
        </p>
      )}
      <button type="button" onClick={save} disabled={pending} className="w-full rounded-lg bg-ink px-5 py-3 text-[15px] font-medium text-on-ink hover:bg-ink-hover disabled:opacity-50 sm:w-auto">
        {pending ? "Saving…" : "Save my choices"}
      </button>
    </div>
  );
}
