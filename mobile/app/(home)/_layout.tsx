import { Stack } from "expo-router";

/**
 * Signed-in home stack: Mail-style index plus task/project detail pushes.
 */
export default function HomeLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "",
          headerShown: true,
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="issues/[id]"
        options={{
          title: "Task",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="projects/[id]/index"
        options={{
          title: "Project",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="projects/[id]/plans/[planId]"
        options={{ title: "Plan", headerShown: true }}
      />
    </Stack>
  );
}
