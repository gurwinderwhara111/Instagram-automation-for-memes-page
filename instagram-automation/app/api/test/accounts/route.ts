import { NextResponse } from "next/server";
import { testInstagramAccount } from "@/lib/meta-client";
import { listPrivateAccounts } from "@/lib/reel-service";
import { createSupabaseAdmin, isAdminRequest, unauthorizedResponse } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Unknown account test error";
  console.error("[test/accounts] Error:", message);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const accounts = await listPrivateAccounts(createSupabaseAdmin());
    const results = await Promise.all(
      accounts.map(async (account) => {
        try {
          const profile = await testInstagramAccount({
            igUserId: account.ig_user_id,
            accessToken: account.access_token
          });

          return {
            id: account.id,
            label: account.label,
            igUserId: account.ig_user_id,
            status: account.status,
            connected: true,
            profile,
            error: null
          } as const;
        } catch (error) {
          return {
            id: account.id,
            label: account.label,
            igUserId: account.ig_user_id,
            status: account.status,
            connected: false,
            profile: null,
            error: error instanceof Error ? error.message : "Unknown Meta account test error"
          } as const;
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    return errorResponse(error, 500);
  }
}
