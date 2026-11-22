import { Stack } from "expo-router";

import { DrawerScene } from "@/components/navigation/drawer-scene";
import { usePearlStackScreenOptions } from "@/src/navigation-theme";

/** Keep Directory list under template detail pushes so native back works. */
export const unstable_settings = {
  anchor: "index",
};

export default function AgentDirectoryStackLayout() {
  const screenOptions = usePearlStackScreenOptions();

  return (
    <DrawerScene>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={{ title: "Directory" }} />
        <Stack.Screen name="[slug]" options={{ title: "Agent" }} />
      </Stack>
    </DrawerScene>
  );
}
