import { PlanScreen } from "@/components/settings/plan-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Profile → Plan. Travel and other plan preferences. */
export default function PlanRoute() {
  return (
    <RequireSignedIn>
      <PlanScreen />
    </RequireSignedIn>
  );
}
