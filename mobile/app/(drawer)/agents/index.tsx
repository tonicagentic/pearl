import { AgentsScreen } from "@/components/home/agents-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Drawer → Delegate (custom agents). */
export default function Agents() {
  return (
    <RequireSignedIn>
      <AgentsScreen />
    </RequireSignedIn>
  );
}
