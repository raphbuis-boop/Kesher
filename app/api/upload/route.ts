import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getOrgId } from "@/lib/org";

const EMAIL_ALLOWED = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const WHATSAPP_ALLOWED = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
]);

// MMS (SMS channel) — JPG/PNG are the most universally supported by US carriers.
// PDF is included per user request; carrier MMS support for PDF is limited.
const SMS_ALLOWED = new Set([
  "image/jpeg", "image/png", "application/pdf",
]);

const FRIENDLY_TYPES: Record<string, string> = {
  email: "images, PDFs, Word documents, and Excel spreadsheets",
  whatsapp: "images and PDFs",
  sms: "a JPG, PNG, or PDF",
};

const MMS_BUCKET = "mms-media";
const MMS_MAX_BYTES = 5 * 1024 * 1024; // 5 MB — Sinch MMS; carriers may reject >600 KB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const channel = (formData.get("channel") as string | null) ?? "email";

    if (!file) {
      return NextResponse.json({ error: "No file was received." }, { status: 400 });
    }

    // ── SMS / MMS → Supabase Storage ────────────────────────────────────────
    // Sinch MMS requires a publicly accessible URL. Supabase Storage public
    // buckets serve files without auth headers, which carriers can fetch.
    // No extra env var needed — admin client is already required for the app.
    if (channel === "sms") {
      if (!SMS_ALLOWED.has(file.type)) {
        return NextResponse.json(
          { error: `This file type isn't supported. Please attach ${FRIENDLY_TYPES.sms}.` },
          { status: 400 }
        );
      }

      if (file.size > MMS_MAX_BYTES) {
        return NextResponse.json(
          { error: "The file is too large. Please attach a file under 5 MB." },
          { status: 400 }
        );
      }

      let orgId: string;
      try {
        orgId = await getOrgId();
      } catch {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
      }

      const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_");
      const path = `${orgId}/${Date.now()}-${safeName}`;

      const adminClient = createSupabaseAdminClient();
      const buffer = await file.arrayBuffer();
      const { error: uploadError } = await adminClient.storage
        .from(MMS_BUCKET)
        .upload(path, buffer, { contentType: file.type, upsert: false });

      if (uploadError) {
        const msg = (uploadError as { message?: string }).message ?? "";
        if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("does not exist")) {
          return NextResponse.json(
            { error: `Storage bucket "${MMS_BUCKET}" not found. Create it in the Supabase dashboard (Storage → New bucket → name: "${MMS_BUCKET}", public: on).` },
            { status: 503 }
          );
        }
        console.error("[upload] MMS storage error:", uploadError);
        return NextResponse.json(
          { error: "The file could not be uploaded. Please try again." },
          { status: 500 }
        );
      }

      const { data: { publicUrl } } = adminClient.storage
        .from(MMS_BUCKET)
        .getPublicUrl(path);

      return NextResponse.json({
        url: publicUrl,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      });
    }

    // ── Email / WhatsApp → Vercel Blob (existing path) ───────────────────────
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "Attachments are not available." }, { status: 503 });
    }

    const allowed = channel === "whatsapp" ? WHATSAPP_ALLOWED : EMAIL_ALLOWED;
    if (!allowed.has(file.type)) {
      const types = FRIENDLY_TYPES[channel] ?? "supported file types";
      return NextResponse.json(
        { error: `This file type isn't supported. Please attach ${types}.` },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "The file is too large. Please attach a file under 10 MB." },
        { status: 400 }
      );
    }

    const blob = await put(file.name, file, {
      access: "public",
      contentType: file.type,
    });

    return NextResponse.json({
      url: blob.url,
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    });
  } catch {
    return NextResponse.json(
      { error: "The file could not be uploaded. Please try again." },
      { status: 500 }
    );
  }
}
