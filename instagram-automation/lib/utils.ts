export const exampleBucketName = "Instagram reels and clips storage";

export const exampleVideoUrl =
  "https://abnfrtvuxnuslmebcbca.supabase.co/storage/v1/object/public/Instagram%20reels%20and%20clips%20storage/venon-clip-1.mp4";

export function deriveVideoPath(videoUrl: string): string | null {
  try {
    const url = new URL(videoUrl);
    const marker = "/storage/v1/object/public/";
    const index = url.pathname.indexOf(marker);
    if (index === -1) {
      return null;
    }
    const fullPath = decodeURIComponent(url.pathname.slice(index + marker.length));
    const parts = fullPath.split("/");
    if (parts.length < 2) {
      return null;
    }
    return parts.slice(1).join("/");
  } catch {
    return null;
  }
}

export function toLocalInputValue(dateIso: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function formatDateTime(dateIso: string | null): string {
  if (!dateIso) {
    return "-";
  }
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return dateIso;
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function isMutableStatus(status: string): boolean {
  return status === "draft" || status === "scheduled" || status === "failed";
}
