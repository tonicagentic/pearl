import { NotesScreen } from "@/components/notes/notes-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Drawer → Notes hub. */
export default function Notes() {
  return (
    <RequireSignedIn>
      <NotesScreen />
    </RequireSignedIn>
  );
}
