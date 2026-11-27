import type { Metadata } from "next";
import { Suspense } from "react";

import { ConnectionsPanel } from "@/components/finances/connections-panel";
import {
  FinancesCard,
  FinancesLoading,
} from "@/components/finances/finances-shell";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "Connections · Finances",
};

export default function FinancesConnectionsPage() {
  return (
    <Suspense fallback={<FinancesLoading label="Loading connections…" />}>
      <ResolvedConnections />
    </Suspense>
  );
}

async function ResolvedConnections() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <FinancesCard message="Sign in with durable storage configured to manage connections." />
    );
  }

  if (!process.env.FINANCE_DATABASE_URL) {
    return (
      <FinancesCard message="Finance database is not configured for this environment." />
    );
  }

  return <ConnectionsPanel />;
}
