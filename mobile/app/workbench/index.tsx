import { WorkbenchScreen } from "@/components/workbench-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

export default function WorkbenchRoute() {
  return (
    <RequireSignedIn>
      <WorkbenchScreen />
    </RequireSignedIn>
  );
}
