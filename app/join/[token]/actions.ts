"use server";

import { headers } from "next/headers";
import { resolveSignupToken, sendSignupCode, submitSignup, verifySignupCode, type SignupInput, type SignupResult } from "@/lib/signup";

/** Public (no login) actions behind the parent signup form. Every one re-checks the signed link. */

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export async function requestSignupCode(token: string, phone: string): Promise<{ ok: true; otpId: string } | { ok: false; error: string }> {
  const ctx = await resolveSignupToken(token);
  if (!ctx) return { ok: false, error: "This signup link is no longer active." };
  return sendSignupCode(ctx.orgId, phone, await clientIp());
}

export async function checkSignupCode(token: string, otpId: string, phone: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await resolveSignupToken(token);
  if (!ctx) return { ok: false, error: "This signup link is no longer active." };
  return verifySignupCode(ctx.orgId, otpId, phone, code);
}

export async function sendSignup(token: string, input: SignupInput): Promise<SignupResult> {
  const ctx = await resolveSignupToken(token);
  if (!ctx) return { ok: false, error: "This signup link is no longer active." };
  const h = await headers();
  return submitSignup(ctx.orgId, input, await clientIp(), h.get("user-agent"));
}
