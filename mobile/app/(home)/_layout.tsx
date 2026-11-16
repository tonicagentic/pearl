import { Platform } from "react-native";
import { Stack } from "expo-router";

/**
 * Signed-in home stack: Mail home plus chat/profile/detail so the
 * Profile control shares one UINavigationBar and morphs natively.
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
        name="chat"
        options={{
          title: "Chat",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
          headerTransparent: Platform.OS === "ios",
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: "Profile",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="money"
        options={{
          title: "Pearl Money",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
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
