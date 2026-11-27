import { Stack } from "expo-router";

import { DrawerScene } from "@/components/navigation/drawer-scene";
import { usePearlStackScreenOptions } from "@/src/navigation-theme";

export const unstable_settings = {
  anchor: "index",
};

export default function AutomationsStackLayout() {
  const screenOptions = usePearlStackScreenOptions();

  return (
    <DrawerScene>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen
          name="index"
          options={{ title: "Automations", headerShown: false }}
        />
        <Stack.Screen
          name="new"
          options={{
            title: "New Automation",
            headerShown: false,
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="edit"
          options={{
            title: "Edit Automation",
            headerShown: false,
            presentation: "modal",
          }}
        />
      </Stack>
    </DrawerScene>
  );
}
