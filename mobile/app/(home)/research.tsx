import { ResearchScreen } from "@/components/settings/research-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Profile → Research. Deep-research sources. */
export default function ResearchRoute() {
  return (
    <RequireSignedIn>
      <ResearchScreen />
    </RequireSignedIn>
  );
}
