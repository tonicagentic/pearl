import { Redirect, useLocalSearchParams } from "expo-router";

import { ProjectDetailScreen } from "@/components/project-detail-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id || typeof id !== "string") {
    return <Redirect href="/" />;
  }

  return (
    <RequireSignedIn>
      <ProjectDetailScreen projectId={id} />
    </RequireSignedIn>
  );
}
