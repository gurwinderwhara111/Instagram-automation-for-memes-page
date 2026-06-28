"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { PublicInstagramAccount, UploadedImage } from "@/lib/types";
import { uploadFormData, type UploadProgress } from "@/lib/upload-client";
import { formatBytes } from "@/lib/utils";

type AccountTestResult = {
  id: string;
  label: string;
  igUserId: string;
  status: string;
  connected: boolean;
  profile: {
    id?: string;
    user_id?: string;
    username?: string;
    account_type?: string;
    media_count?: number;
  } | null;
  error: string | null;
};

async function readPayload<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    details?: { message?: string }[];
  };
  if (!response.ok) {
    throw new Error(payload.details?.[0]?.message || payload.error || "Request failed");
  }
  return payload;
}

export function TestLabPanel() {
  const [adminPassword, setAdminPassword] = useState("");
  const [accounts, setAccounts] = useState<PublicInstagramAccount[]>([]);
  const [accountTests, setAccountTests] = useState<AccountTestResult[]>([]);
  const [accountId, setAccountId] = useState("");
  const [imageUrl, setImageUrl] = useState(
    "https://abnfrtvuxnuslmebcbca.supabase.co/storage/v1/object/public/Instagram%20reels%20and%20clips%20storage/3d_delivery_box_parcel.jpg"
  );
  const [videoUrl, setVideoUrl] = useState(
    "https://abnfrtvuxnuslmebcbca.supabase.co/storage/v1/object/public/Instagram%20reels%20and%20clips%20storage/venon-clip-16.mp4"
  );
  const [caption, setCaption] = useState("Test post from Instagram automation lab.");
  const [videoCaption, setVideoCaption] = useState("Test reel from Instagram automation lab.");
  const [confirmRealPost, setConfirmRealPost] = useState(false);
  const [confirmRealVideoPost, setConfirmRealVideoPost] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [message, setMessage] = useState("Load accounts before running tests.");
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublishingVideo, setIsPublishingVideo] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadStatus, setUploadStatus] = useState("No upload running.");
  const [lastResult, setLastResult] = useState<unknown>(null);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(adminPassword ? { "x-admin-password": adminPassword } : {})
    }),
    [adminPassword]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAdminPassword(window.sessionStorage.getItem("instagram-admin-password") || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!accountId && accounts[0]?.id) {
      setAccountId(accounts[0].id);
    }
  }, [accountId, accounts]);

  const loadAccounts = async () => {
    setIsLoading(true);
    setMessage("Testing all saved accounts...");
    window.sessionStorage.setItem("instagram-admin-password", adminPassword);

    try {
      const [accountsPayload, testsPayload] = await Promise.all([
        fetch("/api/accounts", { headers, cache: "no-store" }).then((response) =>
          readPayload<{ accounts: PublicInstagramAccount[] }>(response)
        ),
        fetch("/api/test/accounts", { headers, cache: "no-store" }).then((response) =>
          readPayload<{ results: AccountTestResult[] }>(response)
        )
      ]);
      setAccounts(accountsPayload.accounts);
      setAccountTests(testsPayload.results);
      setLastResult(testsPayload);
      setMessage("Account connection tests finished.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to test accounts.");
    } finally {
      setIsLoading(false);
    }
  };

  const publishImageNow = async () => {
    setIsPublishing(true);
    setMessage("Creating a real Instagram image post...");

    try {
      const payload = await fetch("/api/test/instant-image", {
        method: "POST",
        headers,
        body: JSON.stringify({
          accountId,
          imageUrl,
          caption,
          confirmRealPost
        })
      }).then((response) => readPayload(response));

      setLastResult(payload);
      setMessage("Instant image post published.");
      setConfirmRealPost(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Instant image publish failed.");
    } finally {
      setIsPublishing(false);
    }
  };

  const publishVideoNow = async () => {
    setIsPublishingVideo(true);
    setMessage("Creating a real Instagram Reel from the video URL...");

    try {
      const payload = await fetch("/api/test/instant-video", {
        method: "POST",
        headers,
        body: JSON.stringify({
          accountId,
          videoUrl,
          caption: videoCaption,
          confirmRealPost: confirmRealVideoPost
        })
      }).then((response) => readPayload(response));

      setLastResult(payload);
      setMessage("Instant Reel video test finished.");
      setConfirmRealVideoPost(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Instant Reel publish failed.");
    } finally {
      setIsPublishingVideo(false);
    }
  };

  const uploadImage = async () => {
    if (!selectedFile) {
      setMessage("Choose an image file first.");
      return;
    }

    setIsUploading(true);
    setUploadProgress({ loaded: 0, total: selectedFile.size, percent: 0 });
    setUploadStatus("Preparing upload...");
    setMessage("Uploading image to Supabase...");

    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      const payload = await uploadFormData<{ image: UploadedImage }>(
        "/api/test/upload-image",
        formData,
        {
          headers: adminPassword ? { "x-admin-password": adminPassword } : {},
          onProgress: (progress) => {
            setUploadProgress(progress);
            setUploadStatus(
              progress.percent >= 100
                ? "Upload sent. Saving image in Supabase..."
                : `Uploading ${progress.percent}%`
            );
          }
        }
      );

      setUploadedImage(payload.image);
      setImageUrl(payload.image.publicUrl);
      setLastResult(payload);
      setUploadProgress((current) => current ? { ...current, percent: 100 } : current);
      setUploadStatus("Upload complete.");
      setMessage("Image uploaded. The public URL is ready for an instant post test.");
    } catch (error) {
      setUploadStatus("Upload failed.");
      setMessage(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] || null);
    setUploadProgress(null);
    setUploadStatus("Ready to upload.");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
      <div className="flex flex-col gap-4">
        <section className="rounded border border-line bg-white p-4">
          <h2 className="text-xl font-semibold text-ink">Test unlock</h2>
          <p className="mt-1 text-sm text-steel">
            Use the same admin password. Tests run through your server routes so tokens stay hidden.
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
              onClick={loadAccounts}
              disabled={isLoading}
              className="rounded bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-moss disabled:bg-steel/50"
            >
              {isLoading ? "Testing" : "Test accounts"}
            </button>
          </div>
          <p className="mt-3 text-sm text-steel">{message}</p>
        </section>

        <section className="rounded border border-line bg-white p-4">
          <h2 className="text-xl font-semibold text-ink">Supabase image upload</h2>
          <p className="mt-1 text-sm text-steel">
            Upload a random JPG, PNG, or WebP to the bucket and use its public URL for posting.
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFileChange}
            className="mt-4 w-full rounded border border-line bg-panel px-3 py-2 text-sm"
          />
          {selectedFile ? (
            <p className="mt-2 text-sm text-steel">
              {selectedFile.name} · {formatBytes(selectedFile.size)}
            </p>
          ) : null}
          <button
            type="button"
            onClick={uploadImage}
            disabled={isUploading}
            className="mt-4 rounded bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:bg-steel/50"
          >
            {isUploading ? "Uploading..." : "Upload to Supabase"}
          </button>
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
          {uploadedImage ? (
            <div className="mt-4 rounded border border-line bg-panel p-3 text-sm text-steel">
              <p className="font-semibold text-ink">{uploadedImage.path}</p>
              <p>{formatBytes(uploadedImage.size)} · {uploadedImage.mimeType}</p>
              <a
                href={uploadedImage.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-moss hover:text-coral"
              >
                {uploadedImage.publicUrl}
              </a>
            </div>
          ) : null}
        </section>
      </div>

      <div className="flex flex-col gap-4">
        <section className="rounded border border-line bg-white p-4">
          <h2 className="text-xl font-semibold text-ink">Instant image post</h2>
          <p className="mt-1 text-sm text-steel">
            This creates a real Instagram image post immediately. Use a public JPG URL for the cleanest test.
          </p>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-medium text-ink">
              Instagram account
              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
              >
                <option value="">Choose account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label} ({account.ig_user_id})
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Public image URL
              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Caption
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                rows={5}
                className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
              />
            </label>

            <label className="flex items-start gap-2 rounded border border-coral/30 bg-coral/10 p-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={confirmRealPost}
                onChange={(event) => setConfirmRealPost(event.target.checked)}
                className="mt-1"
              />
              <span>I understand this creates a real Instagram post right now.</span>
            </label>
          </div>

          <button
            type="button"
            onClick={publishImageNow}
            disabled={isPublishing || !confirmRealPost}
            className="mt-4 rounded bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:bg-steel/50"
          >
            {isPublishing ? "Publishing..." : "Publish image now"}
          </button>
        </section>

        <section className="rounded border border-line bg-white p-4">
          <h2 className="text-xl font-semibold text-ink">Instant Reel video post</h2>
          <p className="mt-1 text-sm text-steel">
            This creates a real Instagram Reel immediately from a public MP4 URL.
          </p>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-medium text-ink">
              Instagram account
              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
              >
                <option value="">Choose account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label} ({account.ig_user_id})
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Public MP4 URL
              <input
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Caption
              <textarea
                value={videoCaption}
                onChange={(event) => setVideoCaption(event.target.value)}
                rows={5}
                className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
              />
            </label>

            <label className="flex items-start gap-2 rounded border border-coral/30 bg-coral/10 p-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={confirmRealVideoPost}
                onChange={(event) => setConfirmRealVideoPost(event.target.checked)}
                className="mt-1"
              />
              <span>I understand this creates a real Instagram Reel right now.</span>
            </label>
          </div>

          <button
            type="button"
            onClick={publishVideoNow}
            disabled={isPublishingVideo || !confirmRealVideoPost}
            className="mt-4 rounded bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:bg-steel/50"
          >
            {isPublishingVideo ? "Publishing Reel..." : "Publish Reel video now"}
          </button>
        </section>

        <section className="rounded border border-line bg-white p-4">
          <h2 className="text-xl font-semibold text-ink">Account connection results</h2>
          <div className="mt-4 grid gap-3">
            {accountTests.map((result) => (
              <div key={result.id} className="rounded border border-line bg-panel p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink">{result.label}</p>
                  <span
                    className={`rounded border px-2 py-1 text-xs font-semibold ${
                      result.connected
                        ? "border-moss/30 bg-moss/10 text-moss"
                        : "border-coral/30 bg-coral/10 text-coral"
                    }`}
                  >
                    {result.connected ? "connected" : "failed"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-steel">IG user ID: {result.igUserId}</p>
                {result.profile ? (
                  <p className="mt-1 text-sm text-steel">
                    @{result.profile.username || "unknown"} · {result.profile.account_type || "account"} · {result.profile.media_count ?? 0} media
                  </p>
                ) : null}
                {result.error ? <p className="mt-2 text-sm text-coral">{result.error}</p> : null}
              </div>
            ))}
            {!accountTests.length ? (
              <p className="text-sm text-steel">No account tests run yet.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded border border-line bg-white p-4">
          <h2 className="text-xl font-semibold text-ink">Last raw result</h2>
          <pre className="mt-3 max-h-[300px] overflow-auto rounded border border-line bg-panel p-3 text-xs text-steel">
            {lastResult ? JSON.stringify(lastResult, null, 2) : "No result yet."}
          </pre>
        </section>
      </div>
    </div>
  );
}
