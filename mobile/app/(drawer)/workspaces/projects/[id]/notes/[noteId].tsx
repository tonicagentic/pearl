import { useLocalSearchParams } from "expo-router";

import { NoteEditorScreen } from "@/components/workspaces/note-editor-screen";

/** Project hub deep link — same editor as /notes/[id]. */
export default function ProjectNoteRoute() {
  const { noteId } = useLocalSearchParams<{
    id: string;
    noteId: string;
  }>();
  return <NoteEditorScreen noteId={String(noteId)} />;
}
