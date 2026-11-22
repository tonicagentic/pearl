import { Stack } from "expo-router";

import { DrawerScene } from "@/components/navigation/drawer-scene";

/** Keep Workspaces list under project/plan pushes so native back works. */
export const unstable_settings = {
  anchor: "index",
};

export default function WorkspacesStackLayout() {
  return (
    <DrawerScene>
      <Stack
        screenOptions={{
          headerShown: true,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="index" options={{ title: "Workspaces" }} />
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
