import { NextResponse } from "next/server";
import { testInstagramAccount } from "@/lib/meta-client";
import { getPrivateAccount } from "@/lib/reel-service";
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
    const account = await getPrivateAccount(createSupabaseAdmin(), id);
    const profile = await testInstagramAccount({
      igUserId: account.ig_user_id,
      accessToken: account.access_token
    });

    return NextResponse.json({
      connected: true,
      account: {
        id: account.id,
        label: account.label,
        igUserId: account.ig_user_id
      },
      profile
    });
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : "Unknown account test error"
      },
      { status: 400 }
    );
  }
}
