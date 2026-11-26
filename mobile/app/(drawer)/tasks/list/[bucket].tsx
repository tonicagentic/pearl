import { useLocalSearchParams } from "expo-router";

import { TaskListScreen } from "@/components/tasks/task-list-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

export default function TaskSmartListRoute() {
  const params = useLocalSearchParams<{ readonly bucket?: string }>();
  const bucket = typeof params.bucket === "string" ? params.bucket : "inbox";

  return (
    <RequireSignedIn>
      <TaskListScreen bucketParam={bucket} />
    </RequireSignedIn>
  );
}
