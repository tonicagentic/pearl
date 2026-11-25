import { GoalsScreen } from "@/components/goals/goals-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Drawer → Goals hub. */
export default function Goals() {
  return (
    <RequireSignedIn>
      <GoalsScreen />
    </RequireSignedIn>
  );
}
