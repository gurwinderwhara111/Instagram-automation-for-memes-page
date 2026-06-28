import { NextResponse } from "next/server";
import { publishDueReel } from "@/lib/publish-due-reel";
import { createSupabaseAdmin, isAdminRequest, unauthorizedResponse } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const result = await publishDueReel(createSupabaseAdmin());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown publish worker error" },
      { status: 500 }
    );
  }
}
