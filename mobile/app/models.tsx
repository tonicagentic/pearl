import { ModelsScreen } from "@/components/settings/models-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Models settings route; requires the auth gate (redirects home otherwise). */
export default function Models() {
  return (
    <RequireSignedIn>
      <ModelsScreen />
    </RequireSignedIn>
  );
}
