import { AppShell } from "@/components/app-shell";
import { SettingsPanel } from "@/components/settings-panel";

export default function SettingsPage() {
  return (
    <AppShell
      title="Settings"
      subtitle="Connect one Instagram professional account for v1 and confirm required secrets."
    >
      <SettingsPanel />
    </AppShell>
  );
}
