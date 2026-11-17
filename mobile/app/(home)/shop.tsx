import { ShopScreen } from "@/components/settings/shop-screen";
import { RequireSignedIn } from "@/src/require-signed-in";

/** Profile → Shop. Clothing sizes. */
export default function ShopRoute() {
  return (
    <RequireSignedIn>
      <ShopScreen />
    </RequireSignedIn>
  );
}
