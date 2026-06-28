import { AppShell } from "@/components/app-shell";
import { TestLabPanel } from "@/components/test-lab-panel";

export default function TestLabPage() {
  return (
    <AppShell
      title="Test Lab"
      subtitle="Verify saved Instagram accounts, upload images to Supabase, and run real instant image or Reel video tests."
    >
      <TestLabPanel />
    </AppShell>
  );
}
