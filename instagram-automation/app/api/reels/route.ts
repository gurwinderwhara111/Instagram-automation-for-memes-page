import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSupabaseAdmin, isAdminRequest, unauthorizedResponse } from "@/lib/supabase-admin";
import { createReel, listReels } from "@/lib/reel-service";
import type { CreateReelInput, ReelStatus } from "@/lib/types";

export const runtime = "nodejs";

const reelStatuses = new Set(["draft", "scheduled", "posting", "posted", "failed"]);

function errorResponse(error: unknown, status = 400) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed", details: error.issues }, { status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unknown error" },
    { status }
  );
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status =
      rawStatus && reelStatuses.has(rawStatus) ? (rawStatus as ReelStatus) : undefined;
    const reels = await listReels(createSupabaseAdmin(), status);
    return NextResponse.json({ reels });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as CreateReelInput;
    const reel = await createReel(createSupabaseAdmin(), body);
    return NextResponse.json({ reel }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
