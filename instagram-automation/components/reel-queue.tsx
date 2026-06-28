"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { ReelStatusBadge } from "@/components/reel-status-badge";
import type {
  BatchReelDraft,
  BucketSummary,
  BucketVideo,
  PublicInstagramAccount,
  ReelStatus,
  ReelWithAccount
} from "@/lib/types";
import { uploadFormData, type UploadProgress } from "@/lib/upload-client";
import { formatBytes, formatDateTime, isMutableStatus } from "@/lib/utils";

type ApiErrorPayload = {
  error?: string;
  details?: { message?: string }[];
};

type WorkerPayload = {
  status: "idle" | "processed" | "failed";
  message?: string;
  processed?: number;
  posted?: number;
  processing?: number;
  failed?: number;
  recovered?: number;
  results?: Array<{
    status: "posted" | "processing" | "failed";
    title?: string;
    error?: string;
  }>;
};

async function readPayload<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;
  if (!response.ok) {
    const detail = payload.details?.[0]?.message;
    throw new Error(detail || payload.error || `Request failed with ${response.status}`);
  }
  return payload;
}

function statusRank(status: ReelStatus): number {
  return {
    failed: 0,
    posting: 1,
    scheduled: 2,
    draft: 3,
    posted: 4
  }[status];
}

function titleFromPath(path: string): string {
  return path
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function defaultScheduleTime(offsetMinutes = 10): string {
  return new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString().slice(0, 16);
}

function makeDraft(video: BucketVideo, accountId: string): BatchReelDraft {
  return {
    draftId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${video.path}-${Date.now()}`,
    title: titleFromPath(video.name),
    videoPath: video.path,
    videoUrl: video.publicUrl,
    caption: "",
    scheduledAt: defaultScheduleTime(),
    accountIds: accountId ? [accountId] : []
  };
}

function accountName(accounts: PublicInstagramAccount[], id: string): string {
  const account = accounts.find((item) => item.id === id);
  return account ? `${account.label} (${account.ig_user_id})` : id;
}

function isMetaProcessing(reel: ReelWithAccount): boolean {
  return (
    reel.status === "scheduled" &&
    Boolean(reel.meta_creation_id) &&
    (reel.error_message || "").toLowerCase().includes("processing")
  );
}

function statusLabel(reel: ReelWithAccount): string {
  if (isMetaProcessing(reel)) {
    return "processing on Meta";
  }
  if (
    reel.status === "scheduled" &&
    (reel.error_message || "").toLowerCase().includes("recovered")
  ) {
    return "stuck recovered";
  }
  return reel.status;
}

export function ReelQueue({
  showForm = true,
  statusFilter,
  title = "Queue"
}: Readonly<{
  showForm?: boolean;
  statusFilter?: ReelStatus;
  title?: string;
}>) {
  const [adminPassword, setAdminPassword] = useState("");
  const [accounts, setAccounts] = useState<PublicInstagramAccount[]>([]);
  const [reels, setReels] = useState<ReelWithAccount[]>([]);
  const [storage, setStorage] = useState<BucketSummary | null>(null);
  const [drafts, setDrafts] = useState<BatchReelDraft[]>([]);
  const [message, setMessage] = useState("Enter your admin password, then load the dashboard.");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishingDue, setIsPublishingDue] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadStatus, setUploadStatus] = useState("No upload running.");
  const [isDeletingFiles, setIsDeletingFiles] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [hidePosted, setHidePosted] = useState(true);
  const [queueSearch, setQueueSearch] = useState("");
  const [queueStatus, setQueueStatus] = useState<"all" | ReelStatus>(statusFilter || "all");
  const [queueAccount, setQueueAccount] = useState("all");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(adminPassword ? { "x-admin-password": adminPassword } : {})
    }),
    [adminPassword]
  );

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.status === "active"),
    [accounts]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAdminPassword(window.sessionStorage.getItem("instagram-admin-password") || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setMessage("Loading dashboard...");
    window.sessionStorage.setItem("instagram-admin-password", adminPassword);
    try {
      const query = statusFilter ? `?status=${statusFilter}` : "";
      const [accountsResult, reelsResult, storageResult] = await Promise.allSettled([
        fetch("/api/accounts", { headers, cache: "no-store" }).then((response) =>
          readPayload<{ accounts: PublicInstagramAccount[] }>(response)
        ),
        fetch(`/api/reels${query}`, { headers, cache: "no-store" }).then((response) =>
          readPayload<{ reels: ReelWithAccount[] }>(response)
        ),
        fetch("/api/storage/videos", { headers, cache: "no-store" }).then((response) =>
          readPayload<{ storage: BucketSummary }>(response)
        )
      ]);

      if (accountsResult.status === "fulfilled") {
        setAccounts(accountsResult.value.accounts);
      }
      if (reelsResult.status === "fulfilled") {
        setReels(reelsResult.value.reels);
      }
      if (storageResult.status === "fulfilled") {
        setStorage(storageResult.value.storage);
      }

      const failures = [accountsResult, reelsResult, storageResult]
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => (result.reason instanceof Error ? result.reason.message : "Load failed"));

      setMessage(
        failures.length
          ? `Loaded what is available. ${failures[0]}`
          : "Dashboard, queue, and storage loaded."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredVideos = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    return (storage?.videos || []).filter((video) => {
      if (hidePosted && video.fullyPosted) return false;
      if (query && !video.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [hidePosted, librarySearch, storage]);

  const filteredReels = useMemo(() => {
    const query = queueSearch.trim().toLowerCase();
    return reels
      .filter((reel) => (queueStatus === "all" ? true : reel.status === queueStatus))
      .filter((reel) => (queueAccount === "all" ? true : reel.account_id === queueAccount))
      .filter((reel) => {
        if (!query) {
          return true;
        }
        return (
          reel.title.toLowerCase().includes(query) ||
          (reel.video_path || reel.video_url).toLowerCase().includes(query) ||
          (reel.instagram_accounts?.label || "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const rankDiff = statusRank(a.status) - statusRank(b.status);
        if (rankDiff !== 0) {
          return rankDiff;
        }
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      });
  }, [queueAccount, queueSearch, queueStatus, reels]);

  const queueCounts = useMemo(
    () => ({
      scheduled: reels.filter((reel) => reel.status === "scheduled").length,
      posting: reels.filter((reel) => reel.status === "posting").length,
      posted: reels.filter((reel) => reel.status === "posted").length,
      failed: reels.filter((reel) => reel.status === "failed").length
    }),
    [reels]
  );

  const automationHealth = useMemo(() => {
    const now = Date.now();
    const dueScheduled = reels.filter(
      (reel) => reel.status === "scheduled" && new Date(reel.scheduled_at).getTime() <= now
    ).length;
    const stuckPosting = reels.filter(
      (reel) =>
        reel.status === "posting" &&
        reel.locked_at &&
        new Date(reel.locked_at).getTime() <= now - 20 * 60 * 1000
    ).length;
    const metaProcessing = reels.filter(isMetaProcessing).length;
    const failed = reels.filter((reel) => reel.status === "failed").length;

    return {
      cronTarget: "https://abnfrtvuxnuslmebcbca.supabase.co/functions/v1/publish-due-reel",
      dueScheduled,
      stuckPosting,
      metaProcessing,
      failed
    };
  }, [reels]);

  const toggleVideo = (video: BucketVideo) => {
    const isSelected = selectedPaths.includes(video.path);
    if (isSelected) {
      setSelectedPaths((current) => current.filter((path) => path !== video.path));
      setDrafts((current) => current.filter((draft) => draft.videoPath !== video.path));
      return;
    }

    setSelectedPaths((current) => [...current, video.path]);
    setDrafts((current) => [
      ...current,
      makeDraft(video, activeAccounts[0]?.id || accounts[0]?.id || "")
    ]);
    setMessage(`Selected ${video.name}. Add caption, time, and accounts in the prep tray.`);
  };

  const updateDraft = (draftId: string, patch: Partial<BatchReelDraft>) => {
    setDrafts((current) =>
      current.map((draft) => (draft.draftId === draftId ? { ...draft, ...patch } : draft))
    );
  };

  const toggleDraftAccount = (draft: BatchReelDraft, accountId: string) => {
    const accountIds = draft.accountIds.includes(accountId)
      ? draft.accountIds.filter((id) => id !== accountId)
      : [...draft.accountIds, accountId];
    updateDraft(draft.draftId, { accountIds });
  };

  const removeDraft = (draft: BatchReelDraft) => {
    setDrafts((current) => current.filter((item) => item.draftId !== draft.draftId));
    setSelectedPaths((current) => current.filter((path) => path !== draft.videoPath));
  };

  const saveBatch = async () => {
    setIsSaving(true);
    setMessage("Creating scheduled reels...");
    try {
      const response = await fetch("/api/reels/batch", {
        method: "POST",
        headers,
        body: JSON.stringify({
          items: drafts.map(({ draftId: _draftId, ...draft }) => ({
            ...draft,
            scheduledAt: new Date(draft.scheduledAt).toISOString()
          }))
        })
      });
      const payload = await readPayload<{ count: number }>(response);
      setMessage(`Scheduled ${payload.count} reel rows.`);
      setDrafts([]);
      setSelectedPaths([]);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to schedule batch.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRow = async (id: string) => {
    setMessage("Deleting reel...");
    try {
      const response = await fetch(`/api/reels/${id}`, {
        method: "DELETE",
        headers
      });
      await readPayload(response);
      setMessage("Reel deleted.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete reel.");
    }
  };

  const retryRow = async (id: string) => {
    setMessage("Retrying reel...");
    try {
      const response = await fetch(`/api/reels/${id}/retry`, {
        method: "POST",
        headers
      });
      await readPayload(response);
      setMessage("Reel moved back to scheduled.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to retry reel.");
    }
  };

  const publishDueNow = async () => {
    setIsPublishingDue(true);
    setMessage("Running due worker...");
    try {
      const response = await fetch("/api/reels/publish-due", {
        method: "POST",
        headers
      });
      const payload = await readPayload<WorkerPayload>(response);
      const summary =
        payload.status === "processed"
          ? `Worker finished. ${payload.posted || 0} posted, ${payload.processing || 0} processing, ${payload.failed || 0} failed, ${payload.recovered || 0} recovered.`
          : payload.message || "No due scheduled reels.";
      setMessage(summary);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to run due-reel worker.");
      await loadData();
    } finally {
      setIsPublishingDue(false);
    }
  };

  const onFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(Array.from(event.target.files || []));
    setUploadProgress(null);
    setUploadStatus("Ready to upload.");
  };

  const uploadVideos = async () => {
    if (!selectedFiles.length) {
      setMessage("Choose MP4 files first.");
      return;
    }

    setIsUploading(true);
    setUploadProgress({ loaded: 0, total: selectedFiles.reduce((sum, file) => sum + file.size, 0), percent: 0 });
    setUploadStatus("Preparing upload...");
    setMessage("Uploading videos to Supabase...");
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));
      const payload = await uploadFormData<{ count: number; deduped?: number; fresh?: number; message?: string }>("/api/storage/videos/upload", formData, {
        headers: adminPassword ? { "x-admin-password": adminPassword } : {},
        onProgress: (progress) => {
          setUploadProgress(progress);
          setUploadStatus(
            progress.percent >= 100
              ? "Upload sent. Saving files in Supabase..."
              : `Uploading ${progress.percent}%`
          );
        }
      });
      setSelectedFiles([]);
      setUploadProgress((current) => current ? { ...current, percent: 100 } : current);
      setUploadStatus("Upload complete.");
      setMessage(payload.message || `Uploaded ${payload.count} video file${payload.count === 1 ? "" : "s"}.`);
      await loadData();
    } catch (error) {
      setUploadStatus("Upload failed.");
      setMessage(error instanceof Error ? error.message : "Video upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const deleteSelectedFiles = async () => {
    setIsDeletingFiles(true);
    setMessage("Deleting selected storage files...");
    try {
      const response = await fetch("/api/storage/videos", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ paths: selectedPaths })
      });
      const payload = await readPayload<{
        deleted: string[];
        blocked: Array<{ path: string; usedByCount: number }>;
      }>(response);
      setMessage(
        payload.blocked.length
          ? `Deleted ${payload.deleted.length}. Blocked ${payload.blocked.length} used file(s).`
          : `Deleted ${payload.deleted.length} storage file(s).`
      );
      setSelectedPaths((current) => current.filter((path) => !payload.deleted.includes(path)));
      setDrafts((current) => current.filter((draft) => !payload.deleted.includes(draft.videoPath)));
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete storage files.");
    } finally {
      setIsDeletingFiles(false);
    }
  };

  const usage = storage?.usage;
  const usagePercent = usage?.usedPercent || 0;
  const usageWarning = usagePercent >= 80;

  return (
    <>
    <div className="grid gap-5 xl:grid-cols-[460px_1fr]">
      <div className="flex flex-col gap-4">
        <section className="rounded border border-line bg-white p-4">
          <h2 className="text-xl font-semibold text-ink">Admin unlock</h2>
          <p className="mt-1 text-sm text-steel">
            Load accounts, storage, and queue data without exposing server secrets.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              className="min-w-0 flex-1 rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
              placeholder="ADMIN_PASSWORD"
            />
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="rounded bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-moss disabled:bg-steel/50"
            >
              {isLoading ? "Loading" : "Load"}
            </button>
          </div>
          <p className="mt-3 text-sm text-steel">{message}</p>
        </section>

        {showForm ? (
          <>
            <section className="rounded border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-ink">Storage overview</h2>
                  <p className="mt-1 text-sm text-steel">
                    {storage
                      ? `${storage.totalVideos} videos in ${storage.bucket}`
                      : "Load the dashboard to see Supabase storage usage."}
                  </p>
                </div>
                {usage ? (
                  <span className="rounded border border-line bg-panel px-3 py-2 text-xs font-semibold text-ink">
                    {usage.usedLabel} / {usage.limitLabel}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded bg-panel">
                <div
                  className={`h-full ${usageWarning ? "bg-coral" : "bg-moss"}`}
                  style={{ width: `${Math.max(usagePercent, 2)}%` }}
                />
              </div>
              <p className={`mt-2 text-sm ${usageWarning ? "text-coral" : "text-steel"}`}>
                {usage
                  ? `${usage.usedPercent.toFixed(1)}% used. ${usage.remainingLabel} remaining.`
                  : "Free-plan bucket limit is shown as 1 GB."}
              </p>
            </section>

            <section className="rounded border border-line bg-white p-4">
              <h2 className="text-xl font-semibold text-ink">Upload MP4 clips</h2>
              <p className="mt-1 text-sm text-steel">
                Select multiple MP4 files. Keep each clip under 50 MB.
              </p>
              <input
                type="file"
                multiple
                accept="video/mp4,.mp4"
                onChange={onFilesSelected}
                className="mt-4 w-full rounded border border-line bg-panel px-3 py-2 text-sm"
              />
              {selectedFiles.length ? (
                <div className="mt-3 max-h-28 overflow-auto rounded border border-line bg-panel p-3 text-xs text-steel">
                  {selectedFiles.map((file) => (
                    <p key={`${file.name}-${file.size}`}>
                      {file.name} · {formatBytes(file.size)}
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 rounded border border-line bg-panel p-3">
                <div className="flex items-center justify-between gap-3 text-xs text-steel">
                  <span>{uploadStatus}</span>
                  <span>{uploadProgress ? `${uploadProgress.percent}%` : "0%"}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-white">
                  <div
                    className="h-full bg-moss transition-all"
                    style={{ width: `${uploadProgress?.percent || 0}%` }}
                  />
                </div>
                {uploadProgress ? (
                  <p className="mt-2 text-xs text-steel">
                    {formatBytes(uploadProgress.loaded)} / {formatBytes(uploadProgress.total)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={uploadVideos}
                disabled={isUploading}
                className="mt-4 rounded bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:bg-steel/50"
              >
                {isUploading ? "Uploading..." : "Upload selected videos"}
              </button>
            </section>

            <section className="rounded border border-line bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-ink">Video library</h2>
                  <p className="mt-1 text-sm text-steel">
                    Select clips, then prepare captions and schedules below.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm text-steel hover:text-ink">
                    <input
                      type="checkbox"
                      checked={hidePosted}
                      onChange={(event) => setHidePosted(event.target.checked)}
                      className="size-4"
                    />
                    Hide posted
                  </label>
                  <button
                  type="button"
                  onClick={deleteSelectedFiles}
                  disabled={isDeletingFiles || !selectedPaths.length}
                  className="rounded border border-coral px-3 py-2 text-sm font-semibold text-coral hover:bg-coral hover:text-white disabled:cursor-not-allowed disabled:border-line disabled:text-steel"
                >
                  {isDeletingFiles ? "Deleting..." : "Delete selected"}
                </button>
              </div>
            </div>
            <input
              value={librarySearch}
              onChange={(event) => setLibrarySearch(event.target.value)}
              className="mt-4 w-full rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
              placeholder="Search bucket videos..."
            />
              <div className="mt-4 max-h-[430px] overflow-auto rounded border border-line">
                {filteredVideos.map((video) => (
                  <label
                    key={video.path}
                    className="flex cursor-pointer items-start gap-3 border-b border-line p-3 last:border-b-0 hover:bg-panel"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPaths.includes(video.path)}
                      onChange={() => toggleVideo(video)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink">{video.name}</p>
                        {video.usedByCount ? (
                          <span className="rounded border border-moss/30 bg-moss/10 px-2 py-1 text-xs text-moss">
                            used by {video.usedByCount}
                          </span>
                        ) : (
                          <span className="rounded border border-line bg-white px-2 py-1 text-xs text-steel">
                            unused
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-steel">
                        {formatBytes(video.size)} · {video.mimeType || "video/mp4"}
                      </p>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPreviewVideo(video.publicUrl);
                        }}
                        className="mt-1 flex items-center gap-1 text-xs text-moss hover:text-coral"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
                          <path d="M6.5 4.5v11l8.5-5.5z" />
                        </svg>
                        Preview
                      </button>
                    </div>
                  </label>
                ))}
                {!filteredVideos.length ? (
                  <p className="p-4 text-sm text-steel">
                    {storage ? "No matching MP4 videos found." : "No bucket data loaded yet."}
                  </p>
                ) : null}
              </div>
            </section>
          </>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        {showForm ? (
          <section className="rounded border border-line bg-white p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-ink">Batch prep tray</h2>
                <p className="mt-1 text-sm text-steel">
                  Each selected video gets its own caption, time, and account choices.
                </p>
              </div>
              <button
                type="button"
                onClick={saveBatch}
                disabled={isSaving || !drafts.length}
                className="rounded bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:bg-steel/50"
              >
                {isSaving ? "Scheduling..." : `Schedule ${drafts.length} draft${drafts.length === 1 ? "" : "s"}`}
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              {drafts.map((draft, index) => (
                <div key={draft.draftId} className="rounded border border-line bg-panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-steel">Clip {index + 1}</p>
                      <p className="mt-1 break-all text-sm text-moss">{draft.videoPath}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDraft(draft)}
                      className="rounded border border-line px-2 py-1 text-xs text-coral hover:border-coral"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-medium text-ink md:col-span-2">
                      Title
                      <input
                        value={draft.title}
                        onChange={(event) => updateDraft(draft.draftId, { title: event.target.value })}
                        className="rounded border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-ink">
                      Scheduled time
                      <input
                        type="datetime-local"
                        value={draft.scheduledAt}
                        onChange={(event) =>
                          updateDraft(draft.draftId, { scheduledAt: event.target.value })
                        }
                        className="rounded border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                      />
                    </label>
                    <div className="grid gap-2 text-sm font-medium text-ink">
                      Instagram accounts
                      <div className="max-h-28 overflow-auto rounded border border-line bg-white p-2">
                        {activeAccounts.map((account) => (
                          <label key={account.id} className="flex items-center gap-2 py-1 text-sm">
                            <input
                              type="checkbox"
                              checked={draft.accountIds.includes(account.id)}
                              onChange={() => toggleDraftAccount(draft, account.id)}
                            />
                            <span>
                              {account.label} ({account.ig_user_id})
                            </span>
                          </label>
                        ))}
                        {!activeAccounts.length ? (
                          <p className="text-sm text-coral">No active accounts loaded.</p>
                        ) : null}
                      </div>
                    </div>
                    <label className="grid gap-2 text-sm font-medium text-ink md:col-span-2">
                      Caption
                      <textarea
                        value={draft.caption}
                        onChange={(event) =>
                          updateDraft(draft.draftId, { caption: event.target.value })
                        }
                        rows={5}
                        className="rounded border border-line bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-moss"
                        placeholder="Paste this clip caption..."
                      />
                    </label>
                    <p className="text-xs text-steel md:col-span-2">
                      Will create {draft.accountIds.length} schedule row
                      {draft.accountIds.length === 1 ? "" : "s"}:{" "}
                      {draft.accountIds.map((id) => accountName(accounts, id)).join(", ") || "choose account"}
                    </p>
                  </div>
                </div>
              ))}
              {!drafts.length ? (
                <p className="rounded border border-dashed border-line p-6 text-center text-sm text-steel">
                  Select one or more bucket videos to start batch scheduling.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {!statusFilter ? (
          <section className="rounded border border-line bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-ink">Automation health</h2>
                <p className="mt-1 text-sm text-steel">
                  Supabase Cron should call the Edge Function every 5 minutes. Vercel does not need
                  to stay open.
                </p>
                <p className="mt-2 break-all rounded bg-panel px-3 py-2 text-xs text-steel">
                  {automationHealth.cronTarget}
                </p>
              </div>
              <div className="grid min-w-full grid-cols-2 gap-2 text-sm md:min-w-[360px]">
                <div className="rounded border border-line p-3">
                  <p className="text-xs uppercase text-steel">Due now</p>
                  <p className="mt-1 text-2xl font-semibold text-ink">
                    {automationHealth.dueScheduled}
                  </p>
                </div>
                <div className="rounded border border-line p-3">
                  <p className="text-xs uppercase text-steel">Meta processing</p>
                  <p className="mt-1 text-2xl font-semibold text-coral">
                    {automationHealth.metaProcessing}
                  </p>
                </div>
                <div className="rounded border border-line p-3">
                  <p className="text-xs uppercase text-steel">Stuck posting</p>
                  <p className="mt-1 text-2xl font-semibold text-red-700">
                    {automationHealth.stuckPosting}
                  </p>
                </div>
                <div className="rounded border border-line p-3">
                  <p className="text-xs uppercase text-steel">Failed</p>
                  <p className="mt-1 text-2xl font-semibold text-red-700">
                    {automationHealth.failed}
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded border border-line bg-white p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-ink">{title}</h2>
                <p className="mt-1 text-sm text-steel">
                  Scheduled {queueCounts.scheduled} · Posting {queueCounts.posting} · Posted{" "}
                  {queueCounts.posted} · Failed {queueCounts.failed}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={loadData}
                  className="rounded border border-line px-3 py-2 text-sm font-medium text-ink hover:border-moss hover:text-moss"
                >
                  Refresh
                </button>
                {!statusFilter || statusFilter === "scheduled" ? (
                  <button
                    type="button"
                    onClick={publishDueNow}
                    disabled={isPublishingDue}
                    className="rounded bg-coral px-3 py-2 text-sm font-semibold text-white hover:bg-ink disabled:bg-steel/50"
                  >
                    {isPublishingDue ? "Running worker..." : "Run due worker"}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <input
                value={queueSearch}
                onChange={(event) => setQueueSearch(event.target.value)}
                className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
                placeholder="Search queue..."
              />
              <select
                value={queueStatus}
                onChange={(event) => setQueueStatus(event.target.value as "all" | ReelStatus)}
                disabled={Boolean(statusFilter)}
                className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss disabled:text-steel"
              >
                <option value="all">All statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="posting">Posting</option>
                <option value="posted">Posted</option>
                <option value="failed">Failed</option>
                <option value="draft">Draft</option>
              </select>
              <select
                value={queueAccount}
                onChange={(event) => setQueueAccount(event.target.value)}
                className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
              >
                <option value="all">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase text-steel">
                  <th className="py-3 pr-3">Reel</th>
                  <th className="py-3 pr-3">Account</th>
                  <th className="py-3 pr-3">Schedule</th>
                  <th className="py-3 pr-3">Status</th>
                  <th className="py-3 pr-3">Meta</th>
                  <th className="py-3 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReels.map((reel) => (
                  <tr key={reel.id} className="border-b border-line align-top">
                    <td className="max-w-[280px] py-3 pr-3">
                      <p className="font-semibold text-ink">{reel.title}</p>
                      <a
                        href={reel.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block truncate text-xs text-moss hover:text-coral"
                      >
                        {reel.video_path || reel.video_url}
                      </a>
                      {reel.error_message ? (
                        <p className="mt-2 text-xs text-red-700">{reel.error_message}</p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-steel">
                      {reel.instagram_accounts?.label || "Missing account"}
                    </td>
                    <td className="py-3 pr-3 text-steel">{formatDateTime(reel.scheduled_at)}</td>
                    <td className="py-3 pr-3">
                      <ReelStatusBadge status={reel.status} label={statusLabel(reel)} />
                      <p className="mt-2 text-xs text-steel">Attempts: {reel.attempts}</p>
                    </td>
                    <td className="py-3 pr-3 text-xs text-steel">
                      <p>Container: {reel.meta_creation_id || "-"}</p>
                      <p className="mt-1">Post: {reel.meta_publish_id || "-"}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-2">
                        {reel.status === "failed" ? (
                          <button
                            type="button"
                            onClick={() => retryRow(reel.id)}
                            className="rounded border border-line px-2 py-1 text-xs text-moss hover:border-moss"
                          >
                            Retry
                          </button>
                        ) : null}
                        {isMutableStatus(reel.status) ? (
                          <button
                            type="button"
                            onClick={() => deleteRow(reel.id)}
                            className="rounded border border-line px-2 py-1 text-xs text-coral hover:border-coral"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredReels.length ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-steel">
                      No reels match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>

      {previewVideo ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewVideo(null)}
        >
          <div
            className="max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl bg-black shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-panel px-4 py-2">
              <span className="text-sm font-semibold text-ink">Preview</span>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                className="rounded p-1 text-steel hover:bg-white/10 hover:text-ink"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <video
              controls
              autoPlay
              className="max-h-[calc(90vh-48px)] w-full"
              src={previewVideo}
            >
              Your browser does not support video playback.
            </video>
          </div>
        </div>
      ) : null}
    </>
  );
}
