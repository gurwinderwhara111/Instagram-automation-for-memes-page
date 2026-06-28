import { NextResponse } from "next/server";
import { deleteBucketVideos, listBucketVideos } from "@/lib/reel-service";
import { createSupabaseAdmin, isAdminRequest, unauthorizedResponse } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const storage = await listBucketVideos(createSupabaseAdmin());
    return NextResponse.json({ storage });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown storage error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as { paths?: string[] };
    const result = await deleteBucketVideos(createSupabaseAdmin(), body.paths || []);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown storage delete error" },
      { status: 400 }
    );
  }
}
