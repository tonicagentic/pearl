import { Redirect, useLocalSearchParams } from "expo-router";

import { ProjectDetailScreen } from "@/components/workspaces/project-detail-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/**
 * Project pushed on the home stack from Overview — native slide + system back
 * pops to Chat|Overview without a custom chevron.
 */
export default function HomeProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id || typeof id !== "string") {
    return <Redirect href="/" />;
  }

  return (
    <RequireSignedIn>
      <ProjectDetailScreen projectId={id} entryFrom="overview" />
    </RequireSignedIn>
  );
}
