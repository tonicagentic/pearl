import { TasksScreen } from "@/components/home/tasks-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Drawer / Profile → Tasks inbox. */
export default function TasksRoute() {
  return (
    <RequireSignedIn>
      <TasksScreen />
    </RequireSignedIn>
  );
}
