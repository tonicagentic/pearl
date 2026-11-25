import { useLocalSearchParams } from "expo-router";

import { FileEditorScreen } from "@/components/workspaces/file-editor-screen";

export default function ProjectFileRoute() {
  const { id, artifactId } = useLocalSearchParams<{
    id: string;
    artifactId: string;
  }>();
  return (
    <FileEditorScreen
      artifactId={String(artifactId)}
      projectId={String(id)}
    />
  );
}
