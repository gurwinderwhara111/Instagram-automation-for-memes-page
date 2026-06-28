import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createServiceClient,
  type InstagramAccount,
  type ScheduledReel
} from "../_shared/supabase.ts";
import {
  createReelContainer,
  getContainerStatus,
  publishReel
} from "../_shared/meta.ts";

const jsonHeaders = {
  "Content-Type": "application/json"
};

const maxWorkerItems = 5;
const maxAutoAttempts = 5;
const stuckPostingAgeMinutes = 20;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders
  });
}

function isAuthorized(request: Request): boolean {
  const expected = Deno.env.get("PUBLISH_WORKER_SECRET");
  if (!expected) {
    return true;
  }
  return request.headers.get("x-worker-secret") === expected;
}

async function markFailed(
  supabase: ReturnType<typeof createServiceClient>,
  reelId: string,
  message: string,
  retryable: boolean
) {
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

async function recoverStuckReels(supabase: ReturnType<typeof createServiceClient>) {
  const { data, error } = await supabase.rpc("recover_stuck_reels", {
    max_age_minutes: stuckPostingAgeMinutes,
    max_attempts: maxAutoAttempts
  });

  if (error) {
    if (error.message.toLowerCase().includes("recover_stuck_reels")) {
      return 0;
    }
    throw new Error(error.message);
  }

  return Number(data || 0);
}

async function publishOneDueReel(supabase: ReturnType<typeof createServiceClient>) {
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
        reel_id: reel.id,
        title: reel.title,
        video_url: reel.video_url,
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

    for (let attempt = 0; attempt < 6; attempt += 1) {
      status = await getContainerStatus({
        creationId,
        accessToken: account.access_token
      });
      statusHistory.push(status);

      if (status !== "IN_PROGRESS") {
        break;
      }

      await delay(8000);
    }

    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Meta container status: ${status}`);
    }

    if (status === "IN_PROGRESS") {
      await supabase
        .from("scheduled_reels")
        .update({
          status: "scheduled",
          error_message:
            "Meta accepted the video, but it was still processing. The next worker run will finish publishing.",
          locked_at: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", reel.id);

      return {
        status: "processing",
        reel_id: reel.id,
        title: reel.title,
        video_url: reel.video_url,
        meta_creation_id: creationId,
        status_history: statusHistory,
        message:
          "Meta accepted the video, but it was still processing. The next worker run will finish publishing."
      };
    }

    const publishId =
      status === "PUBLISHED"
        ? creationId
        : await publishReel({
            igUserId: account.ig_user_id,
            accessToken: account.access_token,
            creationId
          });

    const { error: updateError } = await supabase
      .from("scheduled_reels")
      .update({
        status: "posted",
        meta_creation_id: creationId,
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
      reel_id: reel.id,
      title: reel.title,
      video_url: reel.video_url,
      meta_creation_id: creationId,
      meta_publish_id: publishId,
      status_history: statusHistory
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown publish error";
    const retryable = isTemporaryPublishError(message) && reel.attempts < maxAutoAttempts;
    await markFailed(supabase, reel.id, message, retryable);
    return {
      status: "failed",
      reel_id: reel.id,
      title: reel.title,
      video_url: reel.video_url,
      error: retryable
        ? `${message}. Temporary failure; worker will retry automatically.`
        : message,
      retryable
    };
  }
}

serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!isAuthorized(request)) {
    return json({ error: "Unauthorized worker request" }, 401);
  }

  const supabase = createServiceClient();

  try {
    const recovered = await recoverStuckReels(supabase);
    const results = [];

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
      return json({
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
      });
    }

    return json({
      status: "processed",
      processed: results.length,
      posted,
      processing,
      failed,
      recovered,
      results,
      message: `Processed ${results.length} due reel${results.length === 1 ? "" : "s"}: ${posted} posted, ${processing} still processing, ${failed} failed.`
    });
  } catch (error) {
    return json(
      {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown worker error"
      },
      500
    );
  }
});
