import { ComputerUseScreen } from "@/components/settings/computer-use-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Computer Use settings route; requires the auth gate. */
export default function ComputerUse() {
  return (
    <RequireSignedIn>
      <ComputerUseScreen />
    </RequireSignedIn>
  );
}
