import { LibraryScreen } from "@/components/home/library-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Drawer → Library inbox of durable agent files and images. */
export default function LibraryRoute() {
  return (
    <RequireSignedIn>
      <LibraryScreen />
    </RequireSignedIn>
  );
}
