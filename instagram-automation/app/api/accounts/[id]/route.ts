import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { updateAccount } from "@/lib/reel-service";
import { createSupabaseAdmin, isAdminRequest, unauthorizedResponse } from "@/lib/supabase-admin";
import type { UpdateAccountInput } from "@/lib/types";

export const runtime = "nodejs";

function errorResponse(error: unknown, status = 400) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed", details: error.issues }, { status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unknown account update error" },
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
    const body = (await request.json()) as UpdateAccountInput;
    const account = await updateAccount(createSupabaseAdmin(), id, body);
    return NextResponse.json({ account });
  } catch (error) {
    return errorResponse(error);
  }
}
