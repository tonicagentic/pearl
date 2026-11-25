import { useLocalSearchParams } from "expo-router";

import { NoteEditorScreen } from "@/components/workspaces/note-editor-screen";

export default function ProjectNoteRoute() {
  const { id, noteId } = useLocalSearchParams<{
    id: string;
    noteId: string;
  }>();
  return <NoteEditorScreen noteId={String(noteId)} projectId={String(id)} />;
}
