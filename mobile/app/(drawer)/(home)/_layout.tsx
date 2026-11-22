import { Platform } from "react-native";
import { Stack } from "expo-router";

import { DrawerOpenSync } from "@/components/navigation/drawer-context";
import { DrawerScene } from "@/components/navigation/drawer-scene";

/**
 * Home stack inside the drawer: Mail (Chat|Delegate) plus pushed /chat for
 * custom-agent threads — restores native back and Stack.Toolbar chrome.
 */
export default function HomeStackLayout() {
  return (
    <DrawerScene>
      <DrawerOpenSync />
      <Stack
        screenOptions={{
          headerShown: true,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: "",
            headerTransparent: Platform.OS === "ios",
          }}
        />
        <Stack.Screen
          name="chat"
          options={{
            title: "Chat",
            headerTransparent: Platform.OS === "ios",
          }}
        />
      </Stack>
    </DrawerScene>
  );
}
