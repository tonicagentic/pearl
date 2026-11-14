import { Stack } from "expo-router";

import { BillingGateScreen } from "@/components/settings/billing-gate-screen";
import { useAuth } from "@/src/auth";

/**
 * Post-auth Stripe gate. Once billing is ready, Stack.Protected
 * reveals the Home tabs.
 */
export default function BillingRoute() {
  const { markBillingReady } = useAuth();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BillingGateScreen onReady={markBillingReady} />
    </>
  );
}
