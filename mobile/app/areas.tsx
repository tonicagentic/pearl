import { AreasScreen } from "@/components/areas-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

export default function Areas() {
  return (
    <RequireSignedIn>
      <AreasScreen />
    </RequireSignedIn>
  );
}
