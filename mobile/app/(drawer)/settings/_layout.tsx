import { Stack } from "expo-router";

import { DrawerScene } from "@/components/navigation/drawer-scene";

export default function SettingsStackLayout() {
  return (
    <DrawerScene>
      <Stack
        screenOptions={{
          headerShown: true,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="index" options={{ title: "Profile" }} />
        <Stack.Screen name="account" options={{ title: "Account" }} />
        <Stack.Screen name="identity" options={{ title: "Identity" }} />
        <Stack.Screen name="memory" options={{ title: "Memory" }} />
        <Stack.Screen name="capabilities" options={{ title: "Capabilities" }} />
        <Stack.Screen name="skills" options={{ title: "Skills" }} />
        <Stack.Screen name="plugins/index" options={{ title: "Plugins" }} />
        <Stack.Screen name="plugins/[id]" options={{ title: "Plugin" }} />
        <Stack.Screen name="email" options={{ title: "Email" }} />
        <Stack.Screen name="calendar" options={{ title: "Calendar" }} />
        <Stack.Screen name="models" options={{ title: "Models" }} />
        <Stack.Screen name="computer-use" options={{ title: "Computer Use" }} />
        <Stack.Screen name="usage" options={{ title: "Usage" }} />
        <Stack.Screen name="billing" options={{ title: "Billing" }} />
        <Stack.Screen name="about" options={{ title: "About" }} />
        <Stack.Screen
          name="connected-agents"
          options={{ title: "Connected agents" }}
        />
        <Stack.Screen name="self-host" options={{ title: "Self-host" }} />
        <Stack.Screen name="money" options={{ title: "Pearl Money" }} />
        <Stack.Screen name="answers" options={{ title: "Answers" }} />
        <Stack.Screen name="drafting" options={{ title: "Drafting" }} />
        <Stack.Screen name="research" options={{ title: "Research" }} />
        <Stack.Screen name="visualize" options={{ title: "Visualize" }} />
        <Stack.Screen name="design" options={{ title: "Design" }} />
        <Stack.Screen name="analysis" options={{ title: "Analysis" }} />
        <Stack.Screen name="storage" options={{ title: "Storage" }} />
        <Stack.Screen name="plan" options={{ title: "Plan" }} />
        <Stack.Screen name="shop" options={{ title: "Shop" }} />
      </Stack>
    </DrawerScene>
  );
}