import type { Metadata } from "next";

import { ConnectedAgentsPanel } from "@/components/connected-agents/connected-agents-panel";

export const metadata: Metadata = {
  title: "Connected agents",
};

export default function ConnectedAgentsSettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Connected agents
        </h1>
        <p className="text-muted-foreground text-sm">
          Chat with private eve deployments from the same Pearl client.
        </p>
      </header>
      <ConnectedAgentsPanel />
    </main>
  );
}
