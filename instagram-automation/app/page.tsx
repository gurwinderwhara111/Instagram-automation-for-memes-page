import { AppShell } from "@/components/app-shell";
import { ReelQueue } from "@/components/reel-queue";

export default function HomePage() {
  return (
    <AppShell>
      <ReelQueue title="Working queue" />
    </AppShell>
  );
}
