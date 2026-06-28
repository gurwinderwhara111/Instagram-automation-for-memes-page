import { AppShell } from "@/components/app-shell";
import { ReelQueue } from "@/components/reel-queue";

export default function QueuePage() {
  return (
    <AppShell
      title="Queue"
      subtitle="Keep upcoming, due, posting, and failed reels under control."
    >
      <ReelQueue title="All reels" />
    </AppShell>
  );
}
