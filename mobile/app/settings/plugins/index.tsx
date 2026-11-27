import { PluginsScreen } from "@/components/settings/plugins-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Plugins settings route; requires the auth gate (redirects home otherwise). */
export default function Plugins() {
  return (
    <RequireSignedIn>
      <PluginsScreen />
    </RequireSignedIn>
  );
}
