import { Redirect } from "expo-router";

import { ModelsScreen } from "@/components/models-screen";
import { useAuth } from "@/src/auth";

/** Models settings route; requires the auth gate (redirects home otherwise). */
export default function Models() {
  const { signedIn } = useAuth();
  if (!signedIn) return <Redirect href="/" />;
  return <ModelsScreen />;
}
