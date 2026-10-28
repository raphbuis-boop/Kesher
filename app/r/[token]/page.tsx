import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { FamilyShell } from "@/app/components/FamilyShell";
import { verifyId } from "@/lib/crypto";
import { confirmRead, getConfirmContext } from "@/lib/confirm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Message received", robots: { index: false } };

async function confirm(formData: FormData) {
  "use server";
  const token = String(formData.get("t") ?? "");
  const rowId = verifyId("confirm", token);
  if (rowId) await confirmRead(rowId);
  redirect(`/r/${encodeURIComponent(token)}`);
}

/** Opened from the "I've read this" link in a message. Nothing is recorded until the person taps the button. */
export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rowId = verifyId("confirm", token);
  const ctx = rowId ? await getConfirmContext(rowId) : null;

  if (!ctx) {
    return (
      <FamilyShell schoolName="">
        <h1 className="mb-2 text-xl font-semibold text-ink">This link isn&apos;t valid</h1>
        <p className="text-[14px] leading-relaxed text-ink-2">It may have been copied incorrectly. Open the link from the original message again.</p>
      </FamilyShell>
    );
  }

  return (
    <FamilyShell schoolName={ctx.schoolName} logoUrl={ctx.logoUrl}>
      {ctx.confirmedAt ? (
        <div className="text-center">
          <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" strokeWidth={1.75} />
          <h1 className="mb-2 text-xl font-semibold text-ink">Thank you{ctx.firstName ? `, ${ctx.firstName}` : ""}</h1>
          <p className="text-[14px] leading-relaxed text-ink-2">{ctx.schoolName || "The school"} knows you&apos;ve seen this message.</p>
        </div>
      ) : (
        <>
          <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-ink-3">Message from {ctx.schoolName || "your school"}</p>
          {ctx.subject && <h1 dir="auto" className="mb-2 text-xl font-semibold text-ink">{ctx.subject}</h1>}
          {ctx.preview && <p dir="auto" className="mb-6 text-[14px] leading-relaxed text-ink-2">{ctx.preview}</p>}
          <form action={confirm}>
            <input type="hidden" name="t" value={token} />
            <button type="submit" className="w-full rounded-lg bg-ink px-5 py-3 text-[15px] font-medium text-on-ink hover:bg-ink-hover sm:w-auto">
              I&apos;ve read this
            </button>
          </form>
          <p className="mt-3 text-[12px] text-ink-3">This just lets the school know you saw it. You don&apos;t need to do anything else.</p>
        </>
      )}
    </FamilyShell>
  );
}
