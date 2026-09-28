import { Redirect } from "expo-router";

import { IssuesScreen } from "@/components/issues-screen";
import { useAuth } from "@/src/auth";

/** The issues inbox route; requires the auth gate (redirects home otherwise). */
export default function Issues() {
  const { signedIn } = useAuth();

  if (!signedIn) {
    return <Redirect href="/" />;
  }

  return <IssuesScreen />;
}
