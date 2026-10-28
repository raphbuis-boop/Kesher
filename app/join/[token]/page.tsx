import type { Metadata } from "next";
import { FamilyShell } from "@/app/components/FamilyShell";
import { canVerifyPhones, formOpenedToken, resolveSignupToken, smsConsentText, whatsappConsentText } from "@/lib/signup";
import { JoinForm } from "./JoinForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Join our school's updates", robots: { index: false } };

/** The page behind the school's signup QR code and link. No login. */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await resolveSignupToken(token);

  if (!ctx) {
    return (
      <FamilyShell schoolName="">
        <h1 className="mb-2 text-xl font-semibold text-ink">This signup link isn&apos;t active</h1>
        <p className="text-[14px] leading-relaxed text-ink-2">The school may have replaced it with a new one. Please ask the office for the current link or QR code.</p>
      </FamilyShell>
    );
  }

  const verifyPhone = await canVerifyPhones(ctx.orgId);
  return (
    <FamilyShell schoolName={ctx.schoolName} logoUrl={ctx.logoUrl}>
      <h1 className="mb-1 text-xl font-semibold text-ink">Get updates from {ctx.schoolName || "your school"}</h1>
      {ctx.settings.intro ? (
        <p dir="auto" className="mb-6 whitespace-pre-line text-[14px] leading-relaxed text-ink-2">{ctx.settings.intro}</p>
      ) : (
        <p className="mb-6 text-[14px] leading-relaxed text-ink-2">Tell us who you are and who your children are, and choose how you&apos;d like to hear from us. The office reviews every signup before messages begin.</p>
      )}
      <JoinForm token={token} openedToken={formOpenedToken()} verifyPhone={verifyPhone} smsConsent={smsConsentText(ctx.schoolName)} whatsappConsent={whatsappConsentText(ctx.schoolName)} schoolName={ctx.schoolName} />
    </FamilyShell>
  );
}
