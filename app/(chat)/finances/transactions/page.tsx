import type { Metadata } from "next";
import { Suspense } from "react";

import {
  FinancesCard,
  FinancesLoading,
} from "@/components/finances/finances-shell";
import { TransactionsRegister } from "@/components/finances/transactions-register";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "Transactions · Finances",
};

export default function FinancesTransactionsPage() {
  return (
    <Suspense fallback={<FinancesLoading label="Loading transactions…" />}>
      <ResolvedTransactions />
    </Suspense>
  );
}

async function ResolvedTransactions() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <FinancesCard message="Sign in with durable storage configured to see transactions." />
    );
  }

  if (!process.env.FINANCE_DATABASE_URL) {
    return (
      <FinancesCard message="Finance database is not configured for this environment." />
    );
  }

  return <TransactionsRegister />;
}
