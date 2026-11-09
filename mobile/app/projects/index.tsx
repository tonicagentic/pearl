import { Redirect } from "expo-router";

import { ProjectsScreen } from "@/components/projects-screen";
import { useAuth } from "@/src/auth";

export default function Projects() {
  const { signedIn, restoring } = useAuth();

  if (restoring) {
    return null;
  }

  if (!signedIn) {
    return <Redirect href="/" />;
  }

  return <ProjectsScreen />;
}
