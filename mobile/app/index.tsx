import { useEffect, useRef, useState } from "react";
import { Stack, router } from "expo-router";

import { BillingGateScreen } from "@/components/billing-gate-screen";
import { HistoryRouteScreen } from "@/components/history-route-screen";
import { PearlIntroScreen } from "@/components/pearl-intro-screen";
import { SelfHostScreen } from "@/components/self-host-screen";
import { SignInScreen } from "@/components/sign-in-screen";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import { resetAgentUrl } from "@/src/eve-transport";

type SignedOutStep = "intro" | "self-host" | "sign-in";

/**
 * Stack root: intro / self-host / sign-in / billing gates, then home (recents).
 * After billing is ready, push a fresh `/chat` once so cold start lands on chat.
 */
export default function Index() {
  const {
    signedIn,
    restoring,
    billingReady,
    markBillingReady,
  } = useAuth();
  const { newChat } = useChats();
  const bootedChat = useRef(false);
  const [signedOutStep, setSignedOutStep] = useState<SignedOutStep>("intro");

  useEffect(() => {
    if (!signedIn || !billingReady || bootedChat.current) return;
    bootedChat.current = true;
    newChat();
    router.push("/chat");
  }, [signedIn, billingReady, newChat]);

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
