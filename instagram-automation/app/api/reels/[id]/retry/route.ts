import { NextResponse } from "next/server";
import { retryReel } from "@/lib/reel-service";
import { createSupabaseAdmin, isAdminRequest, unauthorizedResponse } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await context.params;
    const reel = await retryReel(createSupabaseAdmin(), id);
    return NextResponse.json({ reel });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
