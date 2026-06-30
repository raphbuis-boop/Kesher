import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses Row Level Security.
 *
 * USE ONLY IN SERVER-SIDE CONTEXTS THAT CANNOT CARRY A USER SESSION:
 *   - Webhook handlers (Resend, Telnyx)
 *   - Background jobs / cron routes
 *   - Server Actions that must write on behalf of an external service
 *
 * Never expose this client to the browser or import it from client components.
 * The SUPABASE_SERVICE_ROLE_KEY must be kept server-only (no NEXT_PUBLIC_ prefix).
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — " +
        "add SUPABASE_SERVICE_ROLE_KEY (without NEXT_PUBLIC_) to your environment variables."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      // Disable session persistence — this client is ephemeral per-request
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
