import { TasksScreen } from "@/components/settings/tasks-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Profile → Tasks. Ad for the Pearl Tasks companion app. */
export default function TasksRoute() {
  return (
    <RequireSignedIn>
      <TasksScreen />
    </RequireSignedIn>
  );
}
