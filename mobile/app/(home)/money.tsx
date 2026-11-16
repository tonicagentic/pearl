import { MoneyScreen } from "@/components/settings/money-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Profile → Money. Ad for the Pearl Money companion app. */
export default function MoneyRoute() {
  return (
    <RequireSignedIn>
      <MoneyScreen />
    </RequireSignedIn>
  );
}
