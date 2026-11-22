import { Stack } from "expo-router";

import { DrawerScene } from "@/components/navigation/drawer-scene";

export default function LibraryStackLayout() {
  return (
    <DrawerScene>
      <Stack
        screenOptions={{
          headerShown: true,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="index" options={{ title: "Library" }} />
      </Stack>
    </DrawerScene>
  );
}
