import { StorageScreen } from "@/components/settings/storage-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Profile → Storage. Where files live. */
export default function StorageRoute() {
  return (
    <RequireSignedIn>
      <StorageScreen />
    </RequireSignedIn>
  );
}
