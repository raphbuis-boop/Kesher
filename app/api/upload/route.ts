import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { ADMIN_ROLES, requireRole } from "@/lib/org";

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

const LOGO_ALLOWED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const FRIENDLY_TYPES: Record<string, string> = {
  email: "images, PDFs, Word documents, and Excel spreadsheets",
  whatsapp: "images and PDFs",
};

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Attachments are not available." }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const channel = (formData.get("channel") as string | null) ?? "email";
    const purpose = formData.get("purpose") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file was received." }, { status: 400 });
    }

    // School logo (Settings): images only, 2 MB, stored under logos/<org_id>/ so
    // Settings can later delete it without touching any other org's files.
    if (purpose === "logo") {
      if (!LOGO_ALLOWED.has(file.type)) {
        return NextResponse.json({ error: "Please upload a PNG, JPG, WebP or GIF image." }, { status: 400 });
      }
      if (file.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: "The logo is too large. Please use an image under 2 MB." }, { status: 400 });
      }
      let orgId: string;
      try {
        ({ orgId } = await requireRole(ADMIN_ROLES));
      } catch {
        return NextResponse.json({ error: "Only the owner or an admin can change the school logo." }, { status: 403 });
      }
      const blob = await put(`logos/${orgId}/${file.name}`, file, {
        access: "public",
        contentType: file.type,
        addRandomSuffix: true,
      });
      return NextResponse.json({ url: blob.url, fileName: file.name, contentType: file.type, size: file.size });
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
