import { IdentityScreen } from "@/components/settings/identity-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Identity settings route; requires the auth gate (redirects home otherwise). */
export default function Identity() {
  return (
    <RequireSignedIn>
      <IdentityScreen />
    </RequireSignedIn>
  );
}
