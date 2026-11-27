import type { Metadata } from "next";
import { Suspense } from "react";

import {
  FinancesCard,
  FinancesLoading,
} from "@/components/finances/finances-shell";
import { ReconcilePanel } from "@/components/finances/reconcile-panel";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "Reconcile · Finances",
};

export default function FinancesReconcilePage() {
  return (
    <Suspense fallback={<FinancesLoading label="Loading reconcile…" />}>
      <ResolvedReconcile />
    </Suspense>
  );
}

async function ResolvedReconcile() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <FinancesCard message="Sign in with durable storage configured to reconcile." />
    );
  }

  if (!process.env.FINANCE_DATABASE_URL) {
    return (
      <FinancesCard message="Finance database is not configured for this environment." />
    );
  }

  return <ReconcilePanel />;
}
