import { Platform } from "react-native";
import { Stack } from "expo-router";

import { ObserveInteractiveMarker } from "@/src/observe";

/**
 * Signed-in home stack: Mail home plus chat/profile/detail so the
 * Profile control shares one UINavigationBar and morphs natively.
 * Profile destinations live here too so back stays on this stack.
 */
export default function HomeLayout() {
  return (
    <>
      <ObserveInteractiveMarker />
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
        name="answers"
        options={{
          title: "Answers",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="drafting"
        options={{
          title: "Drafting",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="research"
        options={{
          title: "Research",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="visualize"
        options={{
          title: "Visualize",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="design"
        options={{
          title: "Design",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="files"
        options={{
          title: "Files",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="plan"
        options={{
          title: "Plan",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="shop"
        options={{
          title: "Shop",
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
    </>
  );
}
