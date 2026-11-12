import { Redirect } from "expo-router";

import { IssuesScreen } from "@/components/issues-screen";
import { useAuth } from "@/src/auth";

/** The issues inbox route; requires the auth gate (redirects home otherwise). */
export default function Issues() {
  const { signedIn, restoring } = useAuth();

  if (restoring) {
    // Keychain session check in flight: hold rather than redirecting a
    // signed-in user back home.
    return null;
  }

  if (!signedIn) {
    return <Redirect href="/" />;
  }

  return <IssuesScreen />;
}
