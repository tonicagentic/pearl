import { Stack } from "expo-router";

import { DrawerScene } from "@/components/navigation/drawer-scene";
import { usePearlStackScreenOptions } from "@/src/navigation-theme";

/** Keep Projects list under project/plan pushes so native back works. */
export const unstable_settings = {
  anchor: "index",
};

export default function WorkspacesStackLayout() {
  const screenOptions = usePearlStackScreenOptions();

  return (
    <DrawerScene>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={{ title: "Projects" }} />
        <Stack.Screen
          name="projects/[id]/index"
          options={{ title: "Project" }}
        />
        <Stack.Screen
          name="projects/[id]/plans/[planId]"
          options={{ title: "Plan" }}
        />
      </Stack>
    </DrawerScene>
  );
}
