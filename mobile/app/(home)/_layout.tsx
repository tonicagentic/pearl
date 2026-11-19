import { Platform } from "react-native";
import { Stack } from "expo-router";
import { HistorySidebarHost } from "@/components/home/history-sidebar";
import { ObserveInteractiveMarker } from "@/src/observe";

/**
 * Signed-in home stack: Mail home plus chat/profile/detail so the
 * Profile control shares one UINavigationBar and morphs natively.
 * Profile destinations live here too so back stays on this stack.
 * HistorySidebarHost overlays a draggable history panel on this stack.
 */
export default function HomeLayout() {
  return (
    <HistorySidebarHost>
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
        name="tasks"
        options={{
          title: "Pearl Tasks",
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
        name="analysis"
        options={{
          title: "Analysis",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="storage"
        options={{
          title: "Storage",
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
        name="history"
        options={{
          title: "History",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="workspaces"
        options={{
          title: "Workspaces",
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
      <Stack.Screen
        name="account"
        options={{ title: "Account", headerShown: true }}
      />
      <Stack.Screen
        name="identity"
        options={{ title: "Identity", headerShown: true }}
      />
      <Stack.Screen
        name="memory"
        options={{ title: "Memory", headerShown: true }}
      />
      <Stack.Screen
        name="skills"
        options={{ title: "Skills", headerShown: true }}
      />
      <Stack.Screen
        name="agent-directory"
        options={{ title: "Directory", headerShown: true }}
      />
      <Stack.Screen
        name="plugins/index"
        options={{ title: "Plugins", headerShown: true }}
      />
      <Stack.Screen
        name="plugins/[id]"
        options={{ title: "Plugin", headerShown: true }}
      />
      <Stack.Screen
        name="email"
        options={{
          title: "Email",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="calendar"
        options={{
          title: "Calendar",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="models"
        options={{ title: "Models", headerShown: true }}
      />
      <Stack.Screen
        name="computer-use"
        options={{ title: "Computer Use", headerShown: true }}
      />
      <Stack.Screen
        name="usage"
        options={{
          title: "Usage",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="billing"
        options={{
          title: "Billing",
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="about"
        options={{ title: "About", headerShown: true }}
      />
      <Stack.Screen
        name="connected-agents"
        options={{ title: "Connected agents", headerShown: true }}
      />
      <Stack.Screen
        name="self-host"
        options={{ title: "Self-host", headerShown: true }}
      />
      </Stack>
    </HistorySidebarHost>
  );
}
