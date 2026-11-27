import { Stack } from "expo-router";

import { DrawerScene } from "@/components/navigation/drawer-scene";
import { usePearlStackScreenOptions } from "@/src/navigation-theme";

/** Parked Delegate routes redirect to home / chat. */
export const unstable_settings = {
  anchor: "index",
};

export default function AgentsStackLayout() {
  const screenOptions = usePearlStackScreenOptions();

  return (
    <DrawerScene>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={{ title: "Delegate" }} />
        <Stack.Screen name="chat" options={{ title: "Chat" }} />
      </Stack>
    </DrawerScene>
  );
}
