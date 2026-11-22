import { TasksScreen } from "@/components/tasks/tasks-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Drawer → Tasks inbox. */
export default function Tasks() {
  return (
    <RequireSignedIn>
      <TasksScreen />
    </RequireSignedIn>
  );
}
