import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createBatchReels } from "@/lib/reel-service";
import { createSupabaseAdmin, isAdminRequest, unauthorizedResponse } from "@/lib/supabase-admin";
import type { CreateBatchReelsInput } from "@/lib/types";

export const runtime = "nodejs";

function errorResponse(error: unknown, status = 400) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed", details: error.issues }, { status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unknown batch schedule error" },
    { status }
  );
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as CreateBatchReelsInput;
    const reels = await createBatchReels(createSupabaseAdmin(), body);
    return NextResponse.json({ reels, count: reels.length }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
