import { router, Stack } from "expo-router";
import { ObserveInteractiveMarker } from "@/src/observe";

import { SignInScreen } from "@/components/sign-in-screen";
import { useAuth } from "@/src/auth";

/**
 * Signed-out entry: compact Pearl carousel + continue methods → email.
 * Guests / signup sheet skip the carousel and show methods only.
 * After auth, Stack.Protected swaps this route for the Home tabs.
 */
export default function SignInRoute() {
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
