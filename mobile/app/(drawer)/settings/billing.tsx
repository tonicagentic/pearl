import { BillingScreen } from "@/components/settings/billing-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Profile → Billing. Plan, spend cap, and payment method. */
export default function BillingRoute() {
  return (
    <RequireSignedIn>
      <BillingScreen />
    </RequireSignedIn>
  );
}
