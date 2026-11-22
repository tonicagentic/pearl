import { Stack } from "expo-router";

import { DrawerScene } from "@/components/navigation/drawer-scene";

/** Keep Tasks list under detail pushes so native back works. */
export const unstable_settings = {
  anchor: "index",
};

export default function TasksStackLayout() {
  return (
    <DrawerScene>
      <Stack
        screenOptions={{
          headerShown: true,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="index" options={{ title: "Tasks" }} />
        <Stack.Screen name="[id]" options={{ title: "Task" }} />
      </Stack>
    </DrawerScene>
  );
}
