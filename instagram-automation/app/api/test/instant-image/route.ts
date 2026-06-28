import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createImageContainer, publishMedia } from "@/lib/meta-client";
import { getPrivateAccount } from "@/lib/reel-service";
import { createSupabaseAdmin, isAdminRequest, unauthorizedResponse } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const instantImageSchema = z.object({
  accountId: z.string().uuid("Choose an Instagram account."),
  imageUrl: z
    .string()
    .trim()
    .url("Use a valid public HTTPS image URL.")
    .refine((value) => value.startsWith("https://"), "Image URL must start with https://"),
  caption: z.string().trim().min(1, "Caption is required.").max(2200),
  confirmRealPost: z.literal(true, {
    error: "Confirm that this will create a real Instagram post."
  })
});

function errorResponse(error: unknown, status = 400) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed", details: error.issues }, { status });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unknown instant post error" },
    { status }
  );
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const payload = instantImageSchema.parse(await request.json());
    const account = await getPrivateAccount(createSupabaseAdmin(), payload.accountId);

    const creationId = await createImageContainer({
      igUserId: account.ig_user_id,
      accessToken: account.access_token,
      imageUrl: payload.imageUrl,
      caption: payload.caption
    });

    const publishId = await publishMedia({
      igUserId: account.ig_user_id,
      accessToken: account.access_token,
      creationId
    });

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        label: account.label,
        igUserId: account.ig_user_id
      },
      imageUrl: payload.imageUrl,
      metaCreationId: creationId,
      metaPublishId: publishId
    });
  } catch (error) {
    return errorResponse(error, 500);
  }
}
