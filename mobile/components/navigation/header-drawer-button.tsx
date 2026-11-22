import { DrawerButton } from "@/components/navigation/drawer-button";
import { usePearlDrawer } from "@/components/navigation/drawer-context";

/** Standard header control to open the Expo Router drawer. */
export function HeaderDrawerButton() {
  const { openDrawer } = usePearlDrawer();
  return <DrawerButton onPress={openDrawer} accessibilityLabel="Open menu" />;
}
