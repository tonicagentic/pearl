import { Stack } from "expo-router";

import { DrawerScene } from "@/components/navigation/drawer-scene";
import { usePearlStackScreenOptions } from "@/src/navigation-theme";

export const unstable_settings = {
  anchor: "index",
};

export default function GoalsStackLayout() {
  const screenOptions = usePearlStackScreenOptions();

  return (
    <DrawerScene>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={{ title: "Goals" }} />
        <Stack.Screen name="[id]" options={{ title: "Goal" }} />
      </Stack>
    </DrawerScene>
  );
}
