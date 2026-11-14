import { WorkbenchDetailScreen } from "@/components/workbench-detail-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

export default function WorkbenchDetailRoute() {
  return (
    <RequireSignedIn>
      <WorkbenchDetailScreen />
    </RequireSignedIn>
  );
}
