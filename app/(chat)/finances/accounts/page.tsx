import type { Metadata } from "next";
import { Suspense } from "react";

import { ChartOfAccountsPanel } from "@/components/finances/chart-of-accounts-panel";
import {
  FinancesCard,
  FinancesLoading,
} from "@/components/finances/finances-shell";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "Chart of accounts · Finances",
};

export default function FinancesAccountsPage() {
  return (
    <Suspense fallback={<FinancesLoading label="Loading chart of accounts…" />}>
      <ResolvedAccounts />
    </Suspense>
  );
}

async function ResolvedAccounts() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <FinancesCard message="Sign in with durable storage configured to manage the chart of accounts." />
    );
  }

  if (!process.env.FINANCE_DATABASE_URL) {
    return (
      <FinancesCard message="Finance database is not configured for this environment." />
    );
  }

  return <ChartOfAccountsPanel />;
}
