import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createAccount, listAccounts } from "@/lib/reel-service";
import { createSupabaseAdmin, isAdminRequest, unauthorizedResponse } from "@/lib/supabase-admin";
import type { CreateAccountInput } from "@/lib/types";

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

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const accounts = await listAccounts(createSupabaseAdmin());
    return NextResponse.json({ accounts });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as CreateAccountInput;
    const account = await createAccount(createSupabaseAdmin(), body);
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
