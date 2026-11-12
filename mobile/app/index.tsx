import { useEffect, useRef } from "react";
import { Stack, router } from "expo-router";

import { BillingGateScreen } from "@/components/billing-gate-screen";
import { HistoryRouteScreen } from "@/components/history-route-screen";
import { SignInScreen } from "@/components/sign-in-screen";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";

/**
 * Stack root: sign-in / billing gates, then home (recents).
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
        <SignInScreen />
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
