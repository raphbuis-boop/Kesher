import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** Number of conversations with unread parent messages, for the sidebar badge. Scoped to the signed-in user's school by RLS. */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ unread: 0 }, { status: 401 });
  const { data: membership } = await supabase.from("memberships").select("org_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!membership) return NextResponse.json({ unread: 0 });
  const { count } = await supabase.from("message_threads").select("id", { count: "exact", head: true }).eq("org_id", membership.org_id).gt("unread_count", 0).eq("status", "open");
  return NextResponse.json({ unread: count ?? 0 });
}
