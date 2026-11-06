import { Redirect } from "expo-router";

import { IdentityScreen } from "@/components/identity-screen";
import { useAuth } from "@/src/auth";

/** Identity settings route; requires the auth gate (redirects home otherwise). */
export default function Identity() {
  const { signedIn } = useAuth();
  if (!signedIn) return <Redirect href="/" />;
  return <IdentityScreen />;
}
