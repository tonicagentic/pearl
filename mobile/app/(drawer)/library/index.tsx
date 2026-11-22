import { LibraryScreen } from "@/components/library/library-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Drawer → Library inbox of durable agent files and images. */
export default function Library() {
  return (
    <RequireSignedIn>
      <LibraryScreen />
    </RequireSignedIn>
  );
}
