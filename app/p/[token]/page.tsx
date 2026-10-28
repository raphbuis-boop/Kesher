import type { Metadata } from "next";
import { FamilyShell } from "@/app/components/FamilyShell";
import { verifyId } from "@/lib/crypto";
import { getPreferenceContext, maskedEmail, maskedPhone } from "@/lib/preferenceCenter";
import { LANGUAGES } from "@/lib/preferences";
import { PreferenceForm } from "./PreferenceForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Message preferences", robots: { index: false } };

/** Opened from the "Message preferences" link in an email, text or WhatsApp message. No login. */
export default async function PreferencesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const personId = verifyId("prefs", token, 7);
  const ctx = personId ? await getPreferenceContext(personId) : null;

  if (!ctx) {
    return (
      <FamilyShell schoolName="">
        <h1 className="mb-2 text-xl font-semibold text-ink">This link isn&apos;t valid</h1>
        <p className="text-[14px] leading-relaxed text-ink-2">Open the &ldquo;Message preferences&rdquo; link from a recent message from your school.</p>
      </FamilyShell>
    );
  }

  return (
    <FamilyShell schoolName={ctx.schoolName} logoUrl={ctx.logoUrl}>
      <h1 className="mb-1 text-xl font-semibold text-ink">Hi {ctx.firstName}, how would you like to hear from us?</h1>
      <p className="mb-6 text-[14px] leading-relaxed text-ink-2">
        These choices are just for you{ctx.email || ctx.phone ? ` (${[maskedEmail(ctx), maskedPhone(ctx)].filter(Boolean).join(" · ")})` : ""}. If your partner also gets messages, they have their own link.
      </p>
      <PreferenceForm
        token={token}
        prefs={{
          email: ctx.prefs.email_enabled,
          sms: ctx.prefs.sms_enabled,
          whatsapp: ctx.prefs.whatsapp_enabled,
          emergencyOnly: ctx.prefs.emergency_only,
          language: ctx.prefs.language,
        }}
        hasEmail={ctx.hasEmail}
        hasPhone={ctx.hasPhone}
        stopped={ctx.stopped}
        groups={ctx.groups}
        languages={LANGUAGES}
        smsConsent={ctx.smsConsent}
        whatsappConsent={ctx.whatsappConsent}
        schoolName={ctx.schoolName}
      />
    </FamilyShell>
  );
}
