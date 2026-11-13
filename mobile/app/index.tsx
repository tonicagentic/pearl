import { useState } from "react";
import { Stack } from "expo-router";

import { BillingGateScreen } from "@/components/billing-gate-screen";
import { HistoryRouteScreen } from "@/components/history-route-screen";
import { PearlIntroScreen } from "@/components/pearl-intro-screen";
import { SelfHostScreen } from "@/components/self-host-screen";
import { SignInScreen } from "@/components/sign-in-screen";
import { useAuth } from "@/src/auth";
import { resetAgentUrl } from "@/src/eve-transport";

type SignedOutStep = "intro" | "self-host" | "sign-in";

/**
 * Stack root: intro / self-host / sign-in / billing gates, then home (recents).
 * Chat opens only when the user picks New chat or a recent thread.
 */
export default function Index() {
  const {
    signedIn,
    restoring,
    billingReady,
    markBillingReady,
  } = useAuth();
  const [signedOutStep, setSignedOutStep] = useState<SignedOutStep>("intro");

  if (restoring) {
    // Keychain session check in flight: render nothing rather than flashing
    // the sign-in screen for a signed-in user.
    return null;
  }

  if (!signedIn) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        {signedOutStep === "intro" ? (
          <PearlIntroScreen
            onContinueWithHost={() => {
              void resetAgentUrl().finally(() => {
                setSignedOutStep("sign-in");
              });
            }}
            onSelfHost={() => setSignedOutStep("self-host")}
          />
        ) : signedOutStep === "self-host" ? (
          <SelfHostScreen
            onBack={() => setSignedOutStep("intro")}
            onConnected={() => setSignedOutStep("sign-in")}
            onUseHosted={() => setSignedOutStep("sign-in")}
          />
        ) : (
          <SignInScreen onBack={() => setSignedOutStep("intro")} />
        )}
      </>
    );
  }

  if (!billingReady) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <BillingGateScreen onReady={markBillingReady} />
      </>
    );
  }

  return <HistoryRouteScreen />;
}
