import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createBatchReelsSchema,
  createAccountSchema,
  createReelSchema,
  updateAccountSchema,
  updateReelSchema,
  type CreateBatchReelsPayload,
  type CreateAccountPayload,
  type CreateReelPayload,
  type UpdateAccountPayload,
  type UpdateReelPayload
} from "@/lib/reel-schema";
import type {
  CreateAccountInput,
  CreateBatchReelsInput,
  CreateReelInput,
  InstagramAccount,
  PublicInstagramAccount,
  BucketSummary,
  BucketVideo,
  ReelStatus,
  ReelWithAccount,
  ScheduledReel,
  UpdateAccountInput,
  UpdateReelInput
} from "@/lib/types";
import { exampleBucketName, formatBytes, isMutableStatus } from "@/lib/utils";

type Supabase = SupabaseClient;
const freeStorageLimitBytes = 1024 * 1024 * 1024;
const protectedStorageStatuses = ["scheduled", "posting", "posted"];

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function publicAccount(account: {
  access_token?: string | null;
  [key: string]: unknown;
}): PublicInstagramAccount {
  const { access_token: accessToken, ...safeAccount } = account;
  return {
    ...(safeAccount as Omit<PublicInstagramAccount, "has_access_token">),
    has_access_token: Boolean(accessToken)
  };
}

function toReelInsert(payload: CreateReelPayload) {
  return {
    account_id: payload.accountId,
    title: payload.title,
    video_path: payload.videoPath,
    video_url: payload.videoUrl,
    caption: payload.caption,
    scheduled_at: payload.scheduledAt,
    status: "scheduled" as ReelStatus
  };
}

function batchItemToInserts(payload: CreateBatchReelsPayload) {
  return payload.items.flatMap((item) =>
    item.accountIds.map((accountId) => ({
      account_id: accountId,
      title: item.title,
      video_path: item.videoPath,
      video_url: item.videoUrl,
      caption: item.caption,
      scheduled_at: item.scheduledAt,
      status: "scheduled" as ReelStatus
    }))
  );
}

function toReelUpdate(payload: UpdateReelPayload) {
  return {
    ...(payload.accountId ? { account_id: payload.accountId } : {}),
    ...(payload.title ? { title: payload.title } : {}),
    ...(payload.videoPath !== undefined ? { video_path: payload.videoPath } : {}),
    ...(payload.videoUrl ? { video_url: payload.videoUrl } : {}),
    ...(payload.caption ? { caption: payload.caption } : {}),
    ...(payload.scheduledAt ? { scheduled_at: payload.scheduledAt } : {})
  };
}

export async function listAccounts(supabase: Supabase): Promise<PublicInstagramAccount[]> {
  const { data, error } = await supabase
    .from("instagram_accounts")
    .select("*")
    .order("created_at", { ascending: false });

  throwIfError(error);
  return (data || []).map(publicAccount);
}

export async function listPrivateAccounts(supabase: Supabase): Promise<InstagramAccount[]> {
  const { data, error } = await supabase
    .from("instagram_accounts")
    .select("*")
    .order("created_at", { ascending: false });

  throwIfError(error);
  return (data || []) as InstagramAccount[];
}

export async function getPrivateAccount(
  supabase: Supabase,
  accountId: string
): Promise<InstagramAccount> {
  const { data, error } = await supabase
    .from("instagram_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("status", "active")
    .single<InstagramAccount>();

  throwIfError(error);
  return data as InstagramAccount;
}

export async function createAccount(
  supabase: Supabase,
  input: CreateAccountInput
): Promise<PublicInstagramAccount> {
  const payload = createAccountSchema.parse(input) as CreateAccountPayload;
  const { data, error } = await supabase
    .from("instagram_accounts")
    .insert({
      label: payload.label,
      ig_user_id: payload.igUserId,
      access_token: payload.accessToken,
      token_expires_at: payload.tokenExpiresAt,
      status: "active"
    })
    .select("*")
    .single();

  throwIfError(error);
  return publicAccount(data);
}

export async function updateAccount(
  supabase: Supabase,
  id: string,
  input: UpdateAccountInput
): Promise<PublicInstagramAccount> {
  const payload = updateAccountSchema.parse(input) as UpdateAccountPayload;
  const update = {
    ...(payload.label ? { label: payload.label } : {}),
    ...(payload.igUserId ? { ig_user_id: payload.igUserId } : {}),
    ...(payload.accessToken ? { access_token: payload.accessToken } : {}),
    ...(payload.tokenExpiresAt !== undefined ? { token_expires_at: payload.tokenExpiresAt } : {}),
    ...(payload.status ? { status: payload.status } : {}),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("instagram_accounts")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  throwIfError(error);
  return publicAccount(data);
}

export async function listReels(
  supabase: Supabase,
  status?: ReelStatus
): Promise<ReelWithAccount[]> {
  let query = supabase
    .from("scheduled_reels")
    .select(
      "*, instagram_accounts(id, label, ig_user_id, status)"
    )
    .order("scheduled_at", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  throwIfError(error);
  return (data || []) as ReelWithAccount[];
}

export async function createReel(
  supabase: Supabase,
  input: CreateReelInput
): Promise<ScheduledReel> {
  const payload = createReelSchema.parse(input) as CreateReelPayload;
  const { data, error } = await supabase
    .from("scheduled_reels")
    .insert(toReelInsert(payload))
    .select("*")
    .single();

  throwIfError(error);
  return data as ScheduledReel;
}

export async function createBatchReels(
  supabase: Supabase,
  input: CreateBatchReelsInput
): Promise<ScheduledReel[]> {
  const payload = createBatchReelsSchema.parse(input) as CreateBatchReelsPayload;
  const inserts = batchItemToInserts(payload);
  const { data, error } = await supabase
    .from("scheduled_reels")
    .insert(inserts)
    .select("*");

  throwIfError(error);
  return (data || []) as ScheduledReel[];
}

export async function updateReel(
  supabase: Supabase,
  id: string,
  input: UpdateReelInput
): Promise<ScheduledReel> {
  const { data: existing, error: fetchError } = await supabase
    .from("scheduled_reels")
    .select("*")
    .eq("id", id)
    .single<ScheduledReel>();

  throwIfError(fetchError);
  if (!existing || !isMutableStatus(existing.status)) {
    throw new Error("Only draft, scheduled, or failed reels can be edited.");
  }

  const payload = updateReelSchema.parse(input) as UpdateReelPayload;
  const update = toReelUpdate(payload);
  const { data, error } = await supabase
    .from("scheduled_reels")
    .update({
      ...update,
      status: existing.status === "failed" ? "scheduled" : existing.status,
      error_message: existing.status === "failed" ? null : existing.error_message
    })
    .eq("id", id)
    .select("*")
    .single();

  throwIfError(error);
  return data as ScheduledReel;
}

export async function retryReel(supabase: Supabase, id: string): Promise<ScheduledReel> {
  const { data, error } = await supabase
    .from("scheduled_reels")
    .update({
      status: "scheduled",
      error_message: null,
      locked_at: null,
      meta_creation_id: null,
      meta_publish_id: null,
      posted_at: null
    })
    .eq("id", id)
    .eq("status", "failed")
    .select("*")
    .single();

  throwIfError(error);
  return data as ScheduledReel;
}

export async function deleteReel(supabase: Supabase, id: string): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from("scheduled_reels")
    .select("status")
    .eq("id", id)
    .single<Pick<ScheduledReel, "status">>();

  throwIfError(fetchError);
  if (!existing || !isMutableStatus(existing.status)) {
    throw new Error("Only draft, scheduled, or failed reels can be deleted.");
  }

  const { error } = await supabase.from("scheduled_reels").delete().eq("id", id);
  throwIfError(error);
}

export async function listBucketVideos(supabase: Supabase): Promise<BucketSummary> {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || exampleBucketName;
  const { data, error } = await supabase.storage.from(bucket).list("", {
    limit: 1000,
    offset: 0,
    sortBy: {
      column: "name",
      order: "asc"
    }
  });

  throwIfError(error);

  const { data: referencedRows, error: referencedError } = await supabase
    .from("scheduled_reels")
    .select("video_path, status");

  throwIfError(referencedError);

  const usedCounts = new Map<string, number>();
  const protectedCounts = new Map<string, number>();
  const nonPostedCounts = new Map<string, number>();
  for (const row of referencedRows || []) {
    const r = row as { video_path?: string | null; status: string };
    const path = r.video_path;
    if (path) {
      usedCounts.set(path, (usedCounts.get(path) || 0) + 1);
      if (protectedStorageStatuses.includes(r.status)) {
        protectedCounts.set(path, (protectedCounts.get(path) || 0) + 1);
      }
      if (r.status !== "posted") {
        nonPostedCounts.set(path, (nonPostedCounts.get(path) || 0) + 1);
      }
    }
  }

  const videos: BucketVideo[] = (data || [])
    .filter((file) => {
      const metadata = file.metadata as { mimetype?: string; size?: number } | null;
      return (
        file.name.toLowerCase().endsWith(".mp4") ||
        metadata?.mimetype?.toLowerCase().startsWith("video/")
      );
    })
    .map((file) => {
      const metadata = file.metadata as { mimetype?: string; size?: number } | null;
      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(file.name);
      const usedByCount = usedCounts.get(file.name) || 0;
      const protectedCount = protectedCounts.get(file.name) || 0;
      const nonPostedCount = nonPostedCounts.get(file.name) || 0;
      return {
        name: file.name,
        path: file.name,
        publicUrl: publicData.publicUrl,
        size: Number(metadata?.size || 0),
        mimeType: metadata?.mimetype || null,
        createdAt: file.created_at || null,
        updatedAt: file.updated_at || null,
        usedByCount,
        pendingCount: nonPostedCount,
        fullyPosted: usedByCount > 0 && nonPostedCount === 0,
        canDelete: protectedCount === 0
      };
    });

  const totalBytes = videos.reduce((sum, video) => sum + video.size, 0);
  const remainingBytes = Math.max(freeStorageLimitBytes - totalBytes, 0);
  const usedPercent = Math.min((totalBytes / freeStorageLimitBytes) * 100, 100);

  return {
    bucket,
    totalVideos: videos.length,
    totalBytes,
    totalSizeLabel: formatBytes(totalBytes),
    usage: {
      limitBytes: freeStorageLimitBytes,
      usedBytes: totalBytes,
      remainingBytes,
      usedPercent,
      limitLabel: formatBytes(freeStorageLimitBytes),
      usedLabel: formatBytes(totalBytes),
      remainingLabel: formatBytes(remainingBytes)
    },
    videos
  };
}

export async function deleteBucketVideos(
  supabase: Supabase,
  paths: string[]
): Promise<{ deleted: string[]; blocked: Array<{ path: string; usedByCount: number }> }> {
  const cleanPaths = [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
  if (!cleanPaths.length) {
    throw new Error("Choose at least one video to delete.");
  }

  const { data: referencedRows, error: referencedError } = await supabase
    .from("scheduled_reels")
    .select("video_path, status")
    .in("status", protectedStorageStatuses)
    .in("video_path", cleanPaths);

  throwIfError(referencedError);

  const usedCounts = new Map<string, number>();
  for (const row of referencedRows || []) {
    const path = (row as { video_path?: string | null }).video_path;
    if (path) {
      usedCounts.set(path, (usedCounts.get(path) || 0) + 1);
    }
  }

  const blocked = [...usedCounts.entries()].map(([path, usedByCount]) => ({
    path,
    usedByCount
  }));
  const deletable = cleanPaths.filter((path) => !usedCounts.has(path));

  if (deletable.length) {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || exampleBucketName;
    const { error } = await supabase.storage.from(bucket).remove(deletable);
    throwIfError(error);
  }

  return {
    deleted: deletable,
    blocked
  };
}
