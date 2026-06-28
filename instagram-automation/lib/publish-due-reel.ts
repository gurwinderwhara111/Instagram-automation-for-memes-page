import type { SupabaseClient } from "@supabase/supabase-js";
import { createReelContainer, getContainerStatus, publishMedia } from "@/lib/meta-client";
import type { InstagramAccount, ScheduledReel } from "@/lib/types";

export type WorkerReelResult =
  | {
      status: "posted";
      reelId: string;
      title: string;
      videoUrl: string;
      metaCreationId: string;
      metaPublishId: string;
      statusHistory: string[];
    }
  | {
      status: "processing";
      reelId: string;
      title: string;
      videoUrl: string;
      metaCreationId: string;
      statusHistory: string[];
      message: string;
    }
  | {
      status: "failed";
      reelId: string;
      title: string;
      videoUrl: string;
      error: string;
      retryable: boolean;
    };

export type PublishDueResult =
  | {
      status: "idle";
      message: string;
      processed: 0;
      posted: 0;
      processing: 0;
      failed: 0;
      recovered: number;
      results: WorkerReelResult[];
    }
  | {
      status: "processed";
      processed: number;
      posted: number;
      processing: number;
      failed: number;
      recovered: number;
      results: WorkerReelResult[];
      message: string;
    };

const maxWorkerItems = 5;
const maxAutoAttempts = 5;
const stuckPostingAgeMinutes = 20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTemporaryPublishError(message: string): boolean {
  const lower = message.toLowerCase();
  return [
    "timeout",
    "timed out",
    "temporarily",
    "temporary",
    "rate limit",
    "too many calls",
    "try again",
    "server error",
    "service unavailable",
    "network",
    "fetch failed",
    "econnreset",
    "etimedout"
  ].some((pattern) => lower.includes(pattern));
}

async function markFailed(
  supabase: SupabaseClient,
  reelId: string,
  message: string,
  retryable: boolean
): Promise<void> {
  await supabase
    .from("scheduled_reels")
    .update({
      status: retryable ? "scheduled" : "failed",
      error_message: message,
      locked_at: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", reelId);
}

async function recoverStuckReels(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("recover_stuck_reels", {
    max_age_minutes: stuckPostingAgeMinutes,
    max_attempts: maxAutoAttempts
  });

  if (error) {
    // Older local databases may not have the RPC yet. Do not block manual worker tests.
    if (error.message.toLowerCase().includes("recover_stuck_reels")) {
      return 0;
    }
    throw new Error(error.message);
  }

  return Number(data || 0);
}

async function publishOneDueReel(supabase: SupabaseClient): Promise<WorkerReelResult | null> {
  const { data: claimedRows, error: claimError } = await supabase.rpc("claim_due_reel");
  if (claimError) {
    throw new Error(claimError.message);
  }

  const reel = (claimedRows?.[0] ?? null) as ScheduledReel | null;
  if (!reel) {
    return null;
  }

  try {
    const { data: account, error: accountError } = await supabase
      .from("instagram_accounts")
      .select("*")
      .eq("id", reel.account_id)
      .eq("status", "active")
      .single<InstagramAccount>();

    if (accountError || !account) {
      const message = accountError?.message || "Instagram account not found or disabled.";
      await markFailed(supabase, reel.id, message, false);
      return {
        status: "failed",
        reelId: reel.id,
        title: reel.title,
        videoUrl: reel.video_url,
        error: message,
        retryable: false
      };
    }

    const creationId =
      reel.meta_creation_id ||
      (await createReelContainer({
        igUserId: account.ig_user_id,
        accessToken: account.access_token,
        videoUrl: reel.video_url,
        caption: reel.caption
      }));

    if (!reel.meta_creation_id) {
      await supabase
        .from("scheduled_reels")
        .update({
          meta_creation_id: creationId,
          updated_at: new Date().toISOString()
        })
        .eq("id", reel.id);
    }

    const statusHistory: string[] = [];
    let status = "IN_PROGRESS";

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      status = await getContainerStatus({
        creationId,
        accessToken: account.access_token
      });
      statusHistory.push(status);

      if (status === "FINISHED" || status === "PUBLISHED") {
        const publishId =
          status === "PUBLISHED"
            ? creationId
            : await publishMedia({
                igUserId: account.ig_user_id,
                accessToken: account.access_token,
                creationId
              });

        const { error: updateError } = await supabase
          .from("scheduled_reels")
          .update({
            status: "posted",
            meta_publish_id: publishId,
            posted_at: new Date().toISOString(),
            error_message: null,
            locked_at: null,
            updated_at: new Date().toISOString()
          })
          .eq("id", reel.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        return {
          status: "posted",
          reelId: reel.id,
          title: reel.title,
          videoUrl: reel.video_url,
          metaCreationId: creationId,
          metaPublishId: publishId,
          statusHistory
        };
      }

      if (status === "ERROR" || status === "EXPIRED") {
        throw new Error(`Meta video container ended with status ${status}.`);
      }

      await sleep(8000);
    }

    await supabase
      .from("scheduled_reels")
      .update({
        status: "scheduled",
        error_message:
          "Meta accepted the video, but it was still processing. Run the worker again to finish publishing.",
        locked_at: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", reel.id);

    return {
      status: "processing",
      reelId: reel.id,
      title: reel.title,
      videoUrl: reel.video_url,
      metaCreationId: creationId,
      statusHistory,
      message:
        "Meta accepted the video, but it was still processing. Run the worker again to finish publishing."
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown publish error";
    const retryable = isTemporaryPublishError(message) && reel.attempts < maxAutoAttempts;
    await markFailed(supabase, reel.id, message, retryable);
    return {
      status: "failed",
      reelId: reel.id,
      title: reel.title,
      videoUrl: reel.video_url,
      error: retryable
        ? `${message}. Temporary failure; worker will retry automatically.`
        : message,
      retryable
    };
  }
}

export async function publishDueReel(supabase: SupabaseClient): Promise<PublishDueResult> {
  const recovered = await recoverStuckReels(supabase);
  const results: WorkerReelResult[] = [];

  for (let index = 0; index < maxWorkerItems; index += 1) {
    const result = await publishOneDueReel(supabase);
    if (!result) {
      break;
    }
    results.push(result);
  }

  const posted = results.filter((result) => result.status === "posted").length;
  const processing = results.filter((result) => result.status === "processing").length;
  const failed = results.filter((result) => result.status === "failed").length;

  if (!results.length) {
    return {
      status: "idle",
      message: recovered
        ? `Recovered ${recovered} stuck reel row${recovered === 1 ? "" : "s"}. No due scheduled reels.`
        : "No due scheduled reels.",
      processed: 0,
      posted: 0,
      processing: 0,
      failed: 0,
      recovered,
      results
    };
  }

  return {
    status: "processed",
    processed: results.length,
    posted,
    processing,
    failed,
    recovered,
    results,
    message: `Processed ${results.length} due reel${results.length === 1 ? "" : "s"}: ${posted} posted, ${processing} still processing, ${failed} failed.`
  };
}
