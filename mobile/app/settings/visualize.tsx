import { VisualizeScreen } from "@/components/settings/visualize-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Profile → Visualize. Graphics, diagrams, SVGs, and images. */
export default function VisualizeRoute() {
  return (
    <RequireSignedIn>
      <VisualizeScreen />
    </RequireSignedIn>
  );
}
