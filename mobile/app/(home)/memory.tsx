import { MemoryScreen } from "@/components/settings/memory-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Memory settings route; requires the auth gate (redirects home otherwise). */
export default function Memory() {
  return (
    <RequireSignedIn>
      <MemoryScreen />
    </RequireSignedIn>
  );
}
