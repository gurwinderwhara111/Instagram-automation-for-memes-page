import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createReelContainer, getContainerStatusWithMeta, publishMedia } from "@/lib/meta-client";
import { getPrivateAccount } from "@/lib/reel-service";
import { createSupabaseAdmin, isAdminRequest, unauthorizedResponse } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const instantVideoSchema = z.object({
  accountId: z.string().uuid("Choose an Instagram account."),
  videoUrl: z
    .string()
    .trim()
    .url("Use a valid public HTTPS video URL.")
    .refine((value) => value.startsWith("https://"), "Video URL must start with https://"),
  caption: z.string().trim().min(1, "Caption is required.").max(2200),
  confirmRealPost: z.literal(true, {
    error: "Confirm that this will create a real Instagram Reel."
  })
});

function errorResponse(error: unknown, status = 400) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed", details: error.issues }, { status });
  }

  const message = error instanceof Error ? error.message : "Unknown instant video post error";
  console.error("[instant-video] Error:", message);
  return NextResponse.json({ error: message }, { status });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const payload = instantVideoSchema.parse(await request.json());
    const account = await getPrivateAccount(createSupabaseAdmin(), payload.accountId);

    const creationId = await createReelContainer({
      igUserId: account.ig_user_id,
      accessToken: account.access_token,
      videoUrl: payload.videoUrl,
      caption: payload.caption
    });

    const statusHistory: string[] = [];
    let finalStatus = "IN_PROGRESS";

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const containerStatus = await getContainerStatusWithMeta({
        creationId,
        accessToken: account.access_token
      });
      finalStatus = containerStatus.status_code;
      statusHistory.push(finalStatus);

      if (finalStatus === "FINISHED" || finalStatus === "PUBLISHED") {
        const publishId =
          finalStatus === "PUBLISHED"
            ? creationId
            : await publishMedia({
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
          videoUrl: payload.videoUrl,
          metaCreationId: creationId,
          metaPublishId: publishId,
          statusHistory
        });
      }

      if (finalStatus === "ERROR" || finalStatus === "EXPIRED") {
        throw new Error(`Meta video container ended with status ${finalStatus}.`);
      }

      await sleep(8000);
    }

    return NextResponse.json({
      success: false,
      pending: true,
      account: {
        id: account.id,
        label: account.label,
        igUserId: account.ig_user_id
      },
      videoUrl: payload.videoUrl,
      metaCreationId: creationId,
      status: finalStatus,
      statusHistory,
      message:
        "Meta accepted the video, but it is still processing. Try again shortly or use the worker path."
    });
  } catch (error) {
    return errorResponse(error, 500);
  }
}
