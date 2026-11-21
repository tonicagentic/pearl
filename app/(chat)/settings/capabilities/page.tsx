import type { Metadata } from "next";
import { Suspense } from "react";

import { toCapabilityDto } from "@/lib/capabilities/serialize";
import { listCapabilities } from "@/lib/db/capabilities";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

import { CapabilitiesSettings } from "./capabilities-client";

export const metadata: Metadata = { title: "Capabilities" };

export default function CapabilitiesPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <header>
            <h1 className="text-lg font-semibold">Capabilities</h1>
            <p className="text-sm text-muted-foreground">
              What you can sell — a marketable skill, product, or service.
              Pearl uses these for work and career conversations. Free-form
              facts stay in Profile; agent playbooks stay in Skills.
            </p>
          </header>
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">
                Loading capabilities…
              </p>
            }
          >
            <AuthenticatedCapabilities />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function AuthenticatedCapabilities() {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);

  if (!viewer) {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm">
        Sign in to manage your capabilities.
      </p>
    );
  }

  if (setup.storageMode !== "database") {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Capabilities need database persistence.
      </p>
    );
  }

  const rows = await listCapabilities(viewer.id, {
    statuses: ["active", "exploring", "archived"],
  });
  return (
    <CapabilitiesSettings initialCapabilities={rows.map(toCapabilityDto)} />
  );
}
