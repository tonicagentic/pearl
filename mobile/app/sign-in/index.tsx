import { router, Stack } from "expo-router";
import { ObserveInteractiveMarker } from "@/src/observe";

import { SignInScreen } from "@/components/sign-in-screen";
import { useAuth } from "@/src/auth";

/**
 * Signed-out entry: compact Pearl carousel + continue methods.
 * Continue with Email pushes `/sign-in/email` with a native slide.
 * Guests / signup sheet skip the carousel and show methods only.
 */
export default function SignInGateRoute() {
  const { isAnonymous, restoring } = useAuth();

  // Stay mounted (and reachable) during session restore so Stack always has
  // an unprotected route, but don't flash auth chrome over a returning session.
  if (restoring) {
    return <Stack.Screen options={{ headerShown: false }} />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SignInScreen
        variant="gate"
        skipIntro={isAnonymous}
        onBack={
          isAnonymous
            ? () => {
                // Opening sign-in from home does not always leave a back
                // entry, so return to home directly.
                if (router.canGoBack()) {
                  router.back();
                  return;
                }
                router.replace("/");
              }
            : undefined
        }
      />
      <ObserveInteractiveMarker />
    </>
  );
}
