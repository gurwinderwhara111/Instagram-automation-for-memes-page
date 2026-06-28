import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdmin, isAdminRequest, unauthorizedResponse } from "@/lib/supabase-admin";
import { exampleBucketName } from "@/lib/utils";

export const runtime = "nodejs";

const maxVideoBytes = 50 * 1024 * 1024;

async function findExistingByHash(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  bucket: string,
  hash: string
): Promise<{ name: string; publicUrl: string } | null> {
  const prefix = `${hash}-`;
  const { data, error } = await supabase.storage.from(bucket).list("", {
    limit: 1000,
    sortBy: { column: "name", order: "asc" }
  });
  if (error) return null;
  const match = data?.find((f) => f.name.startsWith(prefix));
  if (!match) return null;
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(match.name);
  return { name: match.name, publicUrl: urlData.publicUrl };
}

async function fileHash(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

function sanitizeBase(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((file): file is File => file instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: "Choose at least one MP4 file." }, { status: 400 });
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || exampleBucketName;
    const supabase = createSupabaseAdmin();
    const uploaded = [];

    for (const file of files) {
      if (file.type !== "video/mp4" && !file.name.toLowerCase().endsWith(".mp4")) {
        return NextResponse.json(
          { error: `${file.name} is not an MP4 video.` },
          { status: 400 }
        );
      }

      if (file.size > maxVideoBytes) {
        return NextResponse.json(
          { error: `${file.name} is over the 50 MB Supabase free-plan file limit.` },
          { status: 400 }
        );
      }

      const hash = await fileHash(file);
      const existing = await findExistingByHash(supabase, bucket, hash);

      if (existing) {
        uploaded.push({
          bucket,
          path: existing.name,
          name: existing.name,
          publicUrl: existing.publicUrl,
          size: file.size,
          mimeType: "video/mp4",
          duplicate: true,
          deduped: true
        });
        continue;
      }

      const path = `${hash}-${sanitizeBase(file.name)}-${Date.now()}.mp4`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: "video/mp4",
        upsert: false
      });

      if (error) {
        throw new Error(error.message);
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      uploaded.push({
        bucket,
        path,
        name: path,
        publicUrl: data.publicUrl,
        size: file.size,
        mimeType: "video/mp4",
        duplicate: false,
        deduped: false
      });
    }

    const deduped = uploaded.filter((v) => v.deduped).length;
    const fresh = uploaded.length - deduped;

    return NextResponse.json({
      videos: uploaded,
      count: uploaded.length,
      deduped,
      fresh,
      message: deduped
        ? `${fresh} uploaded, ${deduped} skipped (already in bucket).`
        : `Uploaded ${fresh} video${fresh === 1 ? "" : "s"}.`
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown video upload error" },
      { status: 500 }
    );
  }
}
