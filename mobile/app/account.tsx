import { AccountScreen } from "@/components/settings/account-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Account settings route; requires the auth gate (redirects home otherwise). */
export default function Account() {
  return (
    <RequireSignedIn>
      <AccountScreen />
    </RequireSignedIn>
  );
}
