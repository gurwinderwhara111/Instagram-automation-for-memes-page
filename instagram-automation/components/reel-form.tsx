"use client";

import type { CreateReelInput, PublicInstagramAccount, ScheduledReel } from "@/lib/types";
import { deriveVideoPath, exampleVideoUrl } from "@/lib/utils";

export type ReelFormState = CreateReelInput;

export function buildInitialReelForm(accountId = ""): ReelFormState {
  const scheduledAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16);
  return {
    accountId,
    title: "Venon Clip 1",
    videoUrl: exampleVideoUrl,
    videoPath: "venon-clip-1.mp4",
    caption: "",
    scheduledAt
  };
}

export function formFromReel(reel: ScheduledReel): ReelFormState {
  const date = new Date(reel.scheduled_at);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return {
    accountId: reel.account_id,
    title: reel.title,
    videoUrl: reel.video_url,
    videoPath: reel.video_path || deriveVideoPath(reel.video_url),
    caption: reel.caption,
    scheduledAt: new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
  };
}

export function ReelForm({
  accounts,
  value,
  editingId,
  isSaving,
  onChange,
  onCancel,
  onSubmit
}: Readonly<{
  accounts: PublicInstagramAccount[];
  value: ReelFormState;
  editingId: string | null;
  isSaving: boolean;
  onChange: (value: ReelFormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
}>) {
  const update = (patch: Partial<ReelFormState>) => onChange({ ...value, ...patch });

  return (
    <section className="rounded border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">
            {editingId ? "Edit scheduled reel" : "Schedule a reel"}
          </h2>
          <p className="mt-1 text-sm text-steel">
            Use the public Supabase video URL and the caption you want Meta to publish.
          </p>
        </div>
        {editingId ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-line px-3 py-2 text-sm text-steel hover:border-coral hover:text-coral"
          >
            Cancel edit
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-ink">
          Instagram account
          <select
            value={value.accountId}
            onChange={(event) => update({ accountId: event.target.value })}
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
          Scheduled time
          <input
            type="datetime-local"
            value={value.scheduledAt}
            onChange={(event) => update({ scheduledAt: event.target.value })}
            className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink md:col-span-2">
          Title
          <input
            value={value.title}
            onChange={(event) => update({ title: event.target.value })}
            className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink md:col-span-2">
          Public video URL
          <input
            value={value.videoUrl}
            onChange={(event) =>
              update({
                videoUrl: event.target.value,
                videoPath: deriveVideoPath(event.target.value) || value.videoPath
              })
            }
            className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink">
          Video path
          <input
            value={value.videoPath || ""}
            onChange={(event) => update({ videoPath: event.target.value })}
            className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink md:col-span-2">
          Caption
          <textarea
            value={value.caption}
            onChange={(event) => update({ caption: event.target.value })}
            rows={8}
            className="rounded border border-line bg-panel px-3 py-2 text-sm leading-6 outline-none focus:border-moss"
            placeholder="Paste your Reel caption here..."
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isSaving || !accounts.length}
        className="mt-4 rounded bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:cursor-not-allowed disabled:bg-steel/50"
      >
        {isSaving ? "Saving..." : editingId ? "Save changes" : "Add to schedule"}
      </button>
    </section>
  );
}
