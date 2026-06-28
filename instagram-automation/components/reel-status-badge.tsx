import type { ReelStatus } from "@/lib/types";

const styles: Record<ReelStatus, string> = {
  draft: "border-steel/30 bg-white text-steel",
  scheduled: "border-moss/30 bg-moss/10 text-moss",
  posting: "border-coral/30 bg-coral/10 text-coral",
  posted: "border-emerald-600/30 bg-emerald-50 text-emerald-700",
  failed: "border-red-600/30 bg-red-50 text-red-700"
};

export function ReelStatusBadge({
  status,
  label
}: Readonly<{ status: ReelStatus; label?: string }>) {
  return (
    <span className={`rounded border px-2 py-1 text-xs font-semibold ${styles[status]}`}>
      {label || status}
    </span>
  );
}
