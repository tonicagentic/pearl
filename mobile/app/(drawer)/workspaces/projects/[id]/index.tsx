import { Redirect, useLocalSearchParams } from "expo-router";

import {
  ProjectDetailScreen,
  type ProjectEntryFrom,
} from "@/components/workspaces/project-detail-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

function parseEntryFrom(value: string | string[] | undefined): ProjectEntryFrom {
  const raw = Array.isArray(value) ? value[0] : value;
  // Drawer jumps land here with from=drawer (menu leading). Overview pushes
  // onto the home stack instead (`/(home)/project/[id]`).
  if (raw === "drawer") return "drawer";
  return undefined;
}

export default function ProjectDetail() {
  const { id, from } = useLocalSearchParams<{
    id: string;
    from?: string | string[];
  }>();

  if (!id || typeof id !== "string") {
    return <Redirect href="/" />;
  }

  return (
    <RequireSignedIn>
      <ProjectDetailScreen projectId={id} entryFrom={parseEntryFrom(from)} />
    </RequireSignedIn>
  );
}
