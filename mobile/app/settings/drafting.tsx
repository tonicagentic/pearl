import { DraftingScreen } from "@/components/settings/drafting-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Profile → Drafting. Writing styles. */
export default function DraftingRoute() {
  return (
    <RequireSignedIn>
      <DraftingScreen />
    </RequireSignedIn>
  );
}
