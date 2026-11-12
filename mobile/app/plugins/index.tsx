import { Redirect } from "expo-router";

import { PluginsScreen } from "@/components/plugins-screen";
import { useAuth } from "@/src/auth";

/** Plugins settings route; requires the auth gate (redirects home otherwise). */
export default function Plugins() {
  const { signedIn } = useAuth();
  if (!signedIn) return <Redirect href="/" />;
  return <PluginsScreen />;
}
