import { AppShell } from "@/components/app-shell";
import { ReelQueue } from "@/components/reel-queue";

export default function HistoryPage() {
  return (
    <AppShell
      title="Posted history"
      subtitle="Review posted reels and the Meta IDs returned by the publish worker."
    >
      <ReelQueue title="Posted reels" statusFilter="posted" showForm={false} />
    </AppShell>
  );
}
