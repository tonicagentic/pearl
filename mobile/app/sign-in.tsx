import { Stack } from "expo-router";

import { SignInScreen } from "@/components/sign-in-screen";
import { useAuth } from "@/src/auth";
import { ObserveInteractiveMarker } from "@/src/observe";

/**
 * Signed-out entry: email sign-in / sign-up.
 * After auth, Stack.Protected swaps this route for the Home tabs.
 */
export default function SignInRoute() {
  const { restoring } = useAuth();

  // Stay mounted (and reachable) during session restore so Stack always has
  // an unprotected route, but don't flash auth chrome over a returning session.
  if (restoring) {
    return <Stack.Screen options={{ headerShown: false }} />;
  }

  return (
    <>
      <ObserveInteractiveMarker />
      <Stack.Screen options={{ headerShown: false }} />
      <SignInScreen />
    </>
  );
}
