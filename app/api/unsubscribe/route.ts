import { NextRequest, NextResponse } from "next/server";
import { optOutEmailRecipient, verifyUnsubscribeToken } from "@/lib/unsubscribe";

/**
 * RFC 8058 one-click unsubscribe endpoint — the URL in every email's
 * List-Unsubscribe header. Gmail/Yahoo POST here with the body
 * "List-Unsubscribe=One-Click"; no confirmation step, no session.
 */
export async function POST(req: NextRequest) {
  const recipientId = verifyUnsubscribeToken(req.nextUrl.searchParams.get("t"));
  if (!recipientId) {
    return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 400 });
  }

  try {
    const ctx = await optOutEmailRecipient(recipientId);
    if (!ctx) return NextResponse.json({ error: "Unknown recipient" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Unsubscribe failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** A human opening the header URL in a browser gets the confirmation page. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/unsubscribe";
  return NextResponse.redirect(url);
}
