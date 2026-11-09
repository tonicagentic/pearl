import { Redirect, useLocalSearchParams } from "expo-router";

import { ProjectDetailScreen } from "@/components/project-detail-screen";
import { useAuth } from "@/src/auth";

export default function ProjectDetail() {
  const { signedIn, restoring } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  if (restoring) {
    return null;
  }

  if (!signedIn) {
    return <Redirect href="/" />;
  }

  if (!id || typeof id !== "string") {
    return <Redirect href="/projects" />;
  }

  return <ProjectDetailScreen projectId={id} />;
}
