import { Stack } from "expo-router";

import { DrawerScene } from "@/components/navigation/drawer-scene";
import { usePearlStackScreenOptions } from "@/src/navigation-theme";

/** Keep Tasks list under detail pushes so native back works. */
export const unstable_settings = {
  anchor: "index",
};

export default function TasksStackLayout() {
  const screenOptions = usePearlStackScreenOptions();

  return (
    <DrawerScene>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={{ title: "Tasks" }} />
        <Stack.Screen name="list/[bucket]" options={{ title: "List" }} />
        <Stack.Screen name="[id]" options={{ title: "Task" }} />
      </Stack>
    </DrawerScene>
  );
}
