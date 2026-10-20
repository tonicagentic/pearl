import type { Metadata } from "next";
import { Suspense } from "react";
import { ConnectionsSettings } from "./settings-client";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export const metadata: Metadata = { title: "Connections" };

export default function ConnectionsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <header>
            <h1 className="text-lg font-semibold">Connections</h1>
            <p className="text-sm text-muted-foreground">
              See which services are available to eve and check your authorization.
            </p>
          </header>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading connections…</p>}>
            <AuthenticatedConnections />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function AuthenticatedConnections() {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);
  if (!viewer) {
    return <p className="rounded-lg border bg-card p-4 text-sm">Sign in to see connections.</p>;
  }
  return <ConnectionsSettings />;
}
