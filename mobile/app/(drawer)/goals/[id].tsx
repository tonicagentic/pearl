import { useLocalSearchParams } from "expo-router";

import { GoalDetailScreen } from "@/components/goals/goal-detail-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

export default function GoalDetailRoute() {
  const { id } = useLocalSearchParams<{ readonly id: string }>();
  const goalId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  if (!goalId) return null;

  return (
    <RequireSignedIn>
      <GoalDetailScreen goalId={goalId} />
    </RequireSignedIn>
  );
}
