import { useState } from "react";
import { Stack } from "expo-router";

import { PearlIntroScreen } from "@/components/intro/pearl-intro-screen";
import { SelfHostScreen } from "@/components/settings/self-host-screen";
import { SignInScreen } from "@/components/sign-in-screen";
import { useAuth } from "@/src/auth";
import { isHostedLocked, resetAgentUrl } from "@/src/eve-transport";

type SignedOutStep = "intro" | "self-host" | "sign-in";

/**
 * Signed-out entry: intro → optional self-host → email sign-in.
 * After auth, Stack.Protected swaps this route for the Home tabs.
 * Store builds with EXPO_PUBLIC_LOCK_HOSTED hide self-host.
 */
export default function SignInRoute() {
  const { restoring } = useAuth();
  const [step, setStep] = useState<SignedOutStep>("intro");
  const locked = isHostedLocked();

  // Stay mounted (and reachable) during session restore so Stack always has
  // an unprotected route, but don't flash intro over a returning session.
  if (restoring) {
    return <Stack.Screen options={{ headerShown: false }} />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {step === "intro" ? (
        <PearlIntroScreen
          onContinueWithHost={() => {
            void resetAgentUrl().finally(() => {
              setStep("sign-in");
            });
          }}
          onSelfHost={locked ? undefined : () => setStep("self-host")}
        />
      ) : step === "self-host" && !locked ? (
        <SelfHostScreen
          onBack={() => setStep("intro")}
          onConnected={() => setStep("sign-in")}
          onUseHosted={() => setStep("sign-in")}
        />
      ) : (
        <SignInScreen onBack={() => setStep("intro")} />
      )}
    </>
  );
}
