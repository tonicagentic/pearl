import { Stack } from "expo-router";

import { DrawerOpenSync } from "@/components/navigation/drawer-context";
import { DrawerScene } from "@/components/navigation/drawer-scene";
import {
  usePearlHeaderTint,
  usePearlScreenBackground,
} from "@/src/navigation-theme";

/** Keep Mail/Delegate under /chat pushes so native back morphs to the menu. */
export const unstable_settings = {
  anchor: "index",
};

/**
 * Home stack inside the drawer: Mail (Chat|Delegate) plus pushed /chat for
 * custom-agent threads — restores native back and Stack.Toolbar chrome.
 * Do not set headerTransparent / headerStyle on iOS — that opts out of glass.
 */
export default function HomeStackLayout() {
  const backgroundColor = usePearlScreenBackground();
  const headerTintColor = usePearlHeaderTint();

  return (
    <DrawerScene>
      <DrawerOpenSync />
      <Stack
        screenOptions={{
          headerShown: true,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          headerTintColor,
          contentStyle: { backgroundColor },
        }}
      >
        <Stack.Screen name="index" options={{ title: "" }} />
        <Stack.Screen name="chat" options={{ title: "Chat" }} />
      </Stack>
    </DrawerScene>
  );
}
