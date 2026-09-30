import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/app/components/PublicHeader";
import { PublicFooter } from "@/app/components/PublicFooter";
import { getUnsubscribeContext, optOutEmailRecipient, verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const metadata: Metadata = {
  title: "Unsubscribe — Kesher",
  robots: { index: false },
};

/**
 * Footer "Unsubscribe" link target. Asks for a click to confirm instead of
 * unsubscribing on page load, so link scanners that prefetch URLs can't
 * opt people out. Mail clients use the one-click POST in /api/unsubscribe.
 */
async function confirmUnsubscribe(formData: FormData) {
  "use server";
  const token = String(formData.get("t") ?? "");
  const recipientId = verifyUnsubscribeToken(token);
  if (!recipientId) redirect("/unsubscribe");
  await optOutEmailRecipient(recipientId);
  redirect(`/unsubscribe?t=${encodeURIComponent(token)}&done=1`);
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; done?: string }>;
}) {
  const { t, done } = await searchParams;
  const recipientId = verifyUnsubscribeToken(t);
  const ctx = recipientId ? await getUnsubscribeContext(recipientId) : null;
  const from = ctx?.schoolName || "this school";

  let content: React.ReactNode;
  if (!ctx) {
    content = (
      <>
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-3">Link not valid</h1>
        <p className="text-zinc-500">
          This unsubscribe link is invalid or has expired. Use the link at the bottom of a recent email,
          or reply to that email and ask the school to remove you.
        </p>
      </>
    );
  } else if (done) {
    content = (
      <>
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-3">You&apos;re unsubscribed</h1>
        <p className="text-zinc-500">
          <span className="font-medium text-zinc-700">{ctx.contactValue}</span> will no longer receive
          emails from {from}.
        </p>
      </>
    );
  } else {
    content = (
      <>
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-3">Unsubscribe</h1>
        <p className="text-zinc-500 mb-8">
          Stop emails from {from} to{" "}
          <span className="font-medium text-zinc-700">{ctx.contactValue}</span>?
        </p>
        <form action={confirmUnsubscribe}>
          <input type="hidden" name="t" value={t} />
          <button
            type="submit"
            className="rounded-lg bg-[#0f0f0f] px-5 py-2.5 text-[14px] font-medium text-white hover:bg-[#27272a] transition-colors"
          >
            Unsubscribe
          </button>
        </form>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicHeader />
      <main className="flex-1 max-w-[560px] mx-auto w-full px-6 py-20">{content}</main>
      <PublicFooter />
    </div>
  );
}
