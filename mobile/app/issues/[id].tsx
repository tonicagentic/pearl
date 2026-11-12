import { Redirect, useLocalSearchParams } from "expo-router";

import { TaskDetailScreen } from "@/components/task-detail-screen";
import { useAuth } from "@/src/auth";

export default function IssueDetail() {
  const { signedIn, restoring } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  if (restoring) {
    return null;
  }

  if (!signedIn) {
    return <Redirect href="/" />;
  }

  if (!id || typeof id !== "string") {
    return <Redirect href="/issues" />;
  }

  return <TaskDetailScreen issueId={id} />;
}
