import { useLocalSearchParams } from "expo-router";

import { NoteEditorScreen } from "@/components/workspaces/note-editor-screen";

/** Canonical note editor for hub and project-filed notes. */
export default function NoteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <NoteEditorScreen noteId={String(id)} />;
}
