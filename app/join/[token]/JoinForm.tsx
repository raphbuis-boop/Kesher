"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { RELATIONSHIPS, SIGNUP_GRADES } from "@/lib/signupOptions";
import { checkSignupCode, requestSignupCode, sendSignup } from "./actions";

const field = "w-full rounded-lg border border-line bg-card px-3 py-2.5 text-[15px] text-ink outline-none focus:border-ink-3";
const label = "mb-1 block text-[12px] font-medium text-ink-soft";

type Child = { firstName: string; lastName: string; grade: string };

export function JoinForm({
  token,
  openedToken,
  verifyPhone,
  smsConsent,
  whatsappConsent,
  schoolName,
}: {
  token: string;
  openedToken: string;
  verifyPhone: boolean;
  smsConsent: string;
  whatsappConsent: string;
  schoolName: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { duplicate: boolean }>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relationship, setRelationship] = useState("mother");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [children, setChildren] = useState<Child[]>([{ firstName: "", lastName: "", grade: "" }]);
  const [channels, setChannels] = useState({ email: true, sms: true, whatsapp: false });
  const [agreeSms, setAgreeSms] = useState(false);
  const [agreeWhatsapp, setAgreeWhatsapp] = useState(false);
  const [website, setWebsite] = useState("");

  // Phone verification
  const [otpId, setOtpId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);

  const setChild = (i: number, patch: Partial<Child>) => setChildren((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  if (done) {
    return (
      <div className="rounded-xl border border-line bg-card px-6 py-8 text-center">
        <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" strokeWidth={1.75} />
        <h2 className="mb-2 text-lg font-semibold text-ink">{done.duplicate ? "We already have your signup" : "Thank you!"}</h2>
        <p className="text-[14px] leading-relaxed text-ink-2">
          {done.duplicate
            ? "The office is reviewing it. You don't need to do anything else."
            : `The ${schoolName || "school"} office will review your signup. Once it's approved you'll start receiving updates.`}
        </p>
      </div>
    );
  }

  const sendCode = () =>
    start(async () => {
      setCodeMsg(null);
      const res = await requestSignupCode(token, phone);
      if (res.ok) {
        setOtpId(res.otpId);
        setVerified(false);
        setCodeMsg("We texted you a 6-digit code.");
      } else setCodeMsg(res.error);
    });

  const checkCode = () =>
    start(async () => {
      if (!otpId) return;
      const res = await checkSignupCode(token, otpId, phone, code);
      if (res.ok) {
        setVerified(true);
        setCodeMsg(null);
      } else setCodeMsg(res.error);
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await sendSignup(token, {
        guardian: { firstName, lastName, relationship, email, phone },
        children,
        channels,
        agreeSms,
        agreeWhatsapp,
        otpId: verified ? otpId : null,
        website,
        openedToken,
      });
      if (res.ok) setDone({ duplicate: res.duplicate });
      else setError(res.error);
    });
  };

  const needsPhone = channels.sms || channels.whatsapp;

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">About you</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label} htmlFor="j-first">First name</label><input id="j-first" dir="auto" className={field} value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={60} autoComplete="given-name" /></div>
          <div><label className={label} htmlFor="j-last">Last name</label><input id="j-last" dir="auto" className={field} value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={60} autoComplete="family-name" /></div>
        </div>
        <div>
          <label className={label} htmlFor="j-rel">I am their</label>
          <select id="j-rel" className={field} value={relationship} onChange={(e) => setRelationship(e.target.value)}>
            {RELATIONSHIPS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div><label className={label} htmlFor="j-email">Email</label><input id="j-email" type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" /></div>
        <div>
          <label className={label} htmlFor="j-phone">Mobile number</label>
          <div className="flex gap-2">
            <input id="j-phone" type="tel" className={field} value={phone} onChange={(e) => { setPhone(e.target.value); setVerified(false); setOtpId(null); }} maxLength={30} autoComplete="tel" placeholder="(917) 555-0123" />
            {verifyPhone && !verified && (
              <button type="button" onClick={sendCode} disabled={pending || !phone.trim()} className="shrink-0 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-soft hover:bg-canvas disabled:opacity-40">
                {otpId ? "Resend" : "Send code"}
              </button>
            )}
          </div>
          {verifyPhone && otpId && !verified && (
            <div className="mt-2 flex gap-2">
              <input className={field} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              <button type="button" onClick={checkCode} disabled={pending || code.length !== 6} className="shrink-0 rounded-lg bg-ink px-4 text-[13px] font-medium text-on-ink disabled:opacity-40">Verify</button>
            </div>
          )}
          {verified && <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-emerald-700"><CheckCircle2 size={13} /> Number verified</p>}
          {codeMsg && <p className="mt-1.5 text-[12px] text-ink-2">{codeMsg}</p>}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Your children</h2>
        {children.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_90px] gap-2">
            <div><label className={label}>First name</label><input dir="auto" className={field} value={c.firstName} onChange={(e) => setChild(i, { firstName: e.target.value })} maxLength={60} /></div>
            <div><label className={label}>Last name</label><input dir="auto" className={field} value={c.lastName} placeholder={lastName} onChange={(e) => setChild(i, { lastName: e.target.value })} maxLength={60} /></div>
            <div>
              <label className={label}>Grade</label>
              <select className={field} value={c.grade} onChange={(e) => setChild(i, { grade: e.target.value })}>
                <option value="">—</option>
                {SIGNUP_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
        ))}
        <div className="flex gap-3 text-[13px]">
          {children.length < 10 && <button type="button" onClick={() => setChildren((cs) => [...cs, { firstName: "", lastName: "", grade: "" }])} className="font-medium text-ink underline underline-offset-2">+ Add another child</button>}
          {children.length > 1 && <button type="button" onClick={() => setChildren((cs) => cs.slice(0, -1))} className="text-ink-3 hover:text-ink-2">Remove last</button>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">How should we reach you?</h2>
        <label className="flex items-center gap-2 text-[14px] text-ink"><input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={channels.email} onChange={(e) => setChannels((c) => ({ ...c, email: e.target.checked }))} /> Email</label>
        <label className="flex items-center gap-2 text-[14px] text-ink"><input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={channels.sms} onChange={(e) => setChannels((c) => ({ ...c, sms: e.target.checked }))} /> Text message</label>
        {channels.sms && (
          <label className="ml-6 flex items-start gap-2 text-[12px] leading-relaxed text-ink-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--ink)]" checked={agreeSms} onChange={(e) => setAgreeSms(e.target.checked)} />
            <span>{smsConsent}</span>
          </label>
        )}
        <label className="flex items-center gap-2 text-[14px] text-ink"><input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={channels.whatsapp} onChange={(e) => setChannels((c) => ({ ...c, whatsapp: e.target.checked }))} /> WhatsApp</label>
        {channels.whatsapp && (
          <label className="ml-6 flex items-start gap-2 text-[12px] leading-relaxed text-ink-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--ink)]" checked={agreeWhatsapp} onChange={(e) => setAgreeWhatsapp(e.target.checked)} />
            <span>{whatsappConsent}</span>
          </label>
        )}
        {needsPhone && !phone.trim() && <p className="text-[12px] text-amber-700">Add your mobile number above to get texts or WhatsApp.</p>}
      </section>

      {/* Honest people never see or fill this */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[14px] text-red-700">{error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-ink px-5 py-3 text-[15px] font-medium text-on-ink hover:bg-ink-hover disabled:opacity-50 sm:w-auto">
        {pending ? "Sending…" : "Sign up"}
      </button>
    </form>
  );
}
