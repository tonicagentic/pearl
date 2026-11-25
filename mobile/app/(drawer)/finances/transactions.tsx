import { FinancesTransactionsScreen } from "@/components/finances/finances-transactions-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Finances Sankey drilldown list. */
export default function FinancesTransactions() {
  return (
    <RequireSignedIn>
      <FinancesTransactionsScreen />
    </RequireSignedIn>
  );
}
