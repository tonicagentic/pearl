import { CapabilitiesScreen } from "@/components/settings/capabilities-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Capabilities settings route; requires the auth gate. */
export default function Capabilities() {
  return (
    <RequireSignedIn>
      <CapabilitiesScreen />
    </RequireSignedIn>
  );
}
