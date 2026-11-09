import { Redirect, useLocalSearchParams } from "expo-router";

import { PlanEditorScreen } from "@/components/plan-editor-screen";
import { useAuth } from "@/src/auth";

export default function PlanEditor() {
  const { signedIn, restoring } = useAuth();
  const { id, planId } = useLocalSearchParams<{
    id: string;
    planId: string;
  }>();

  if (restoring) {
    return null;
  }

  if (!signedIn) {
    return <Redirect href="/" />;
  }

  if (!id || typeof id !== "string" || !planId || typeof planId !== "string") {
    return <Redirect href="/projects" />;
  }

  return <PlanEditorScreen projectId={id} planId={planId} />;
}
