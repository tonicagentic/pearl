import { DesignScreen } from "@/components/settings/design-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Profile → Design. Presentations, documents, and layouts. */
export default function DesignRoute() {
  return (
    <RequireSignedIn>
      <DesignScreen />
    </RequireSignedIn>
  );
}
