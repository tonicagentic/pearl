import { Redirect, useLocalSearchParams } from "expo-router";

import { TaskDetailScreen } from "@/components/tasks/task-detail-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id || typeof id !== "string") {
    return <Redirect href="/" />;
  }

  return (
    <RequireSignedIn>
      <TaskDetailScreen issueId={id} />
    </RequireSignedIn>
  );
}
