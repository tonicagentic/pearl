import { useState } from "react";
import { Stack } from "expo-router";

import { PearlIntroScreen } from "@/components/pearl-intro-screen";
import { SelfHostScreen } from "@/components/self-host-screen";
import { SignInScreen } from "@/components/sign-in-screen";
import { resetAgentUrl } from "@/src/eve-transport";

type SignedOutStep = "intro" | "self-host" | "sign-in";

/**
 * Signed-out entry: intro → optional self-host → email sign-in.
 * After auth, Stack.Protected swaps this route for the Home tabs.
 */
export default function SignInRoute() {
  const [step, setStep] = useState<SignedOutStep>("intro");

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
          onSelfHost={() => setStep("self-host")}
        />
      ) : step === "self-host" ? (
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
