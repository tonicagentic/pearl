import { WorkspacesScreen } from "@/components/home/workspaces-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

export default function WorkspacesRoute() {
  return (
    <RequireSignedIn>
      <WorkspacesScreen />
    </RequireSignedIn>
  );
}
