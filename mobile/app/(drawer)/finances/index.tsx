import { FinancesScreen } from "@/components/finances/finances-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Drawer → Finances month spend. */
export default function Finances() {
  return (
    <RequireSignedIn>
      <FinancesScreen />
    </RequireSignedIn>
  );
}
