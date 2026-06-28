import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { deleteReel, updateReel } from "@/lib/reel-service";
import { createSupabaseAdmin, isAdminRequest, unauthorizedResponse } from "@/lib/supabase-admin";
import type { UpdateReelInput } from "@/lib/types";

export const runtime = "nodejs";

function errorResponse(error: unknown, status = 400) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed", details: error.issues }, { status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unknown error" },
    { status }
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateReelInput;
    const reel = await updateReel(createSupabaseAdmin(), id, body);
    return NextResponse.json({ reel });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await context.params;
    await deleteReel(createSupabaseAdmin(), id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
