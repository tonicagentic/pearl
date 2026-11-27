import { AnalysisScreen } from "@/components/settings/analysis-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Profile → Analysis. Types Pearl can read from an attachment. */
export default function AnalysisRoute() {
  return (
    <RequireSignedIn>
      <AnalysisScreen />
    </RequireSignedIn>
  );
}
