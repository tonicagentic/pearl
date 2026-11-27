import { FinancesTasksScreen } from "@/components/finances/finances-tasks-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

export default function FinancesTasksRoute() {
  return (
    <RequireSignedIn>
      <FinancesTasksScreen />
    </RequireSignedIn>
  );
}
