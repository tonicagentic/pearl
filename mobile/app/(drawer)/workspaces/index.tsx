import { WorkspacesScreen } from "@/components/workspaces/workspaces-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

export default function Workspaces() {
  return (
    <RequireSignedIn>
      <WorkspacesScreen />
    </RequireSignedIn>
  );
}
