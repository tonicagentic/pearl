import { UsageScreen } from "@/components/settings/usage-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Usage spend settings route; requires the auth gate. */
export default function UsageRoute() {
  return (
    <RequireSignedIn>
      <UsageScreen />
    </RequireSignedIn>
  );
}
