import { Redirect, useLocalSearchParams } from "expo-router";

import { PlanEditorScreen } from "@/components/workspaces/plan-editor-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

export default function PlanEditor() {
  const { id, planId } = useLocalSearchParams<{
    id: string;
    planId: string;
  }>();

  if (!id || typeof id !== "string" || !planId || typeof planId !== "string") {
    return <Redirect href="/" />;
  }

  return (
    <RequireSignedIn>
      <PlanEditorScreen projectId={id} planId={planId} />
    </RequireSignedIn>
  );
}
