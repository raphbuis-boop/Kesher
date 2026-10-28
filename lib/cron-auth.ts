import type { NextRequest } from "next/server";

/** Vercel Cron (and pg_cron / any scheduler) sends "Authorization: Bearer $CRON_SECRET". */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
