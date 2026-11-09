import { Redirect } from "expo-router";

import { ReposScreen } from "@/components/repos-screen";
import { useAuth } from "@/src/auth";

/** The GitHub repos route; requires the auth gate (redirects home otherwise). */
export default function Repos() {
  const { signedIn, restoring } = useAuth();

  if (restoring) {
    return null;
  }

  if (!signedIn) {
    return <Redirect href="/" />;
  }

  return <ReposScreen />;
}
