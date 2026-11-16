import { FilesScreen } from "@/components/settings/files-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Profile → Files. Analysis and storage. */
export default function FilesRoute() {
  return (
    <RequireSignedIn>
      <FilesScreen />
    </RequireSignedIn>
  );
}
