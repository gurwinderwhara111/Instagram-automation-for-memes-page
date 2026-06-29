import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdmin, isAdminRequest, unauthorizedResponse } from "@/lib/supabase-admin";
import { exampleBucketName } from "@/lib/utils";
import type { UploadedImage } from "@/lib/types";

export const runtime = "nodejs";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 10 * 1024 * 1024;

function safeExtension(file: File): string {
  const byMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };
  if (byMime[file.type]) {
    return byMime[file.type];
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : "jpg";
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing image file." }, { status: 400 });
    }

    if (!allowedMimeTypes.has(file.type)) {
      return NextResponse.json(
        { error: "Use a JPG, PNG, or WebP image for this test." },
        { status: 400 }
      );
    }

    if (file.size > maxImageBytes) {
      return NextResponse.json(
        { error: "Image is too large. Keep test images under 10 MB." },
        { status: 400 }
      );
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || exampleBucketName;
    const extension = safeExtension(file);
    const path = `test-images/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false
    });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const image: UploadedImage = {
      bucket,
      path,
      publicUrl: data.publicUrl,
      size: file.size,
      mimeType: file.type
    };

    return NextResponse.json({ image });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown image upload error";
    console.error("[upload-image] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
