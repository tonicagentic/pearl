import { Stack } from "expo-router";

import { DrawerOpenSync } from "@/components/navigation/drawer-context";
import { DrawerScene } from "@/components/navigation/drawer-scene";
import { usePearlStackScreenOptions } from "@/src/navigation-theme";

/** Keep home under /chat pushes so native back morphs to the menu. */
export const unstable_settings = {
  anchor: "index",
};

/**
 * Home stack inside the drawer: Chat|Track plus pushed /chat for guest /
 * history threads (including custom agents).
 * Do not set headerTransparent / headerStyle on iOS — that opts out of glass.
 */
export default function HomeStackLayout() {
  const screenOptions = usePearlStackScreenOptions();

  return (
    <DrawerScene>
      <DrawerOpenSync />
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={{ title: "" }} />
        <Stack.Screen name="chat" options={{ title: "Chat" }} />
      </Stack>
    </DrawerScene>
  );
}
