import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SubagentRunsProvider } from "@/components/assistant-ui/elements/task-card.aui";
import { PushNotificationsBridge } from "@/components/push-notifications-bridge";
import { AuthProvider, useAuth } from "@/src/auth";
import { ChatsProvider } from "@/src/chat-context";
import {
  configureImageModelSelectionPersistence,
  configureModelSelectionPersistence,
  configureVectorModelSelectionPersistence,
  restoreImageModelSelection,
  restoreModelSelection,
  restoreVectorModelSelection,
} from "@/src/model-selection";
import {
  loadSavedImageModelSelection,
  loadSavedModelSelection,
  loadSavedVectorModelSelection,
  saveImageModelSelection,
  saveModelSelection,
  saveVectorModelSelection,
} from "@/src/model-preferences";
import { WorkspaceProvider } from "@/src/workspace-context";

/** Home is the Stack root; chat is pushed on top so streams survive while chatting. */
export default function RootLayout() {
  return <AuthProvider><AuthenticatedLayout /></AuthProvider>;
}

function AuthenticatedLayout() {
  const { signedIn, viewerEmail } = useAuth();
  useEffect(() => {
    configureModelSelectionPersistence(saveModelSelection);
    configureImageModelSelectionPersistence(saveImageModelSelection);
    configureVectorModelSelectionPersistence(saveVectorModelSelection);
    void restoreModelSelection(loadSavedModelSelection).catch(() => {});
    void restoreImageModelSelection(loadSavedImageModelSelection).catch(() => {});
    void restoreVectorModelSelection(loadSavedVectorModelSelection).catch(() => {});
  }, []);
  // Dispose in-memory chat state whenever an account signs out or changes.
  const accountKey = signedIn ? `account:${viewerEmail}` : "signed-out";
  return (
    <ChatsProvider key={accountKey}>
      <WorkspaceProvider>
      <SubagentRunsProvider>
        <PushNotificationsBridge />
        <GestureHandlerRootView className="flex-1">
          <SafeAreaProvider>
            <KeyboardProvider enabled={Platform.OS === "ios" && !Platform.isPad}>
              <StatusBar style="auto" />
              <Stack>
                <Stack.Screen name="index" options={{ title: "", headerShown: true }} />
                <Stack.Screen
                  name="chat"
                  options={{
                    title: "Chat",
                    headerShown: true,
                    // Set here (not only in ChatScreen) so the push animation
                    // never paints the default back control before minimal applies.
                    headerBackButtonDisplayMode: "minimal",
                    headerTransparent: Platform.OS === "ios",
                  }}
                />
                <Stack.Screen
                  name="history"
                  options={{
                    title: "History",
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="projects/index"
                  options={{ title: "Projects", headerShown: true }}
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
                  name="issues/index"
                  options={{ title: "Tasks", headerShown: true }}
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
                  name="settings"
                  options={{ title: "Settings", headerShown: true }}
                />
                <Stack.Screen
                  name="skills"
                  options={{ title: "Skills", headerShown: true }}
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
                  name="models"
                  options={{ title: "Models", headerShown: true }}
                />
                <Stack.Screen
                  name="identity"
                  options={{ title: "Identity", headerShown: true }}
                />
                <Stack.Screen
                  name="about"
                  options={{ title: "About", headerShown: true }}
                />
                <Stack.Screen
                  name="self-host"
                  options={{ title: "Self-host", headerShown: true }}
                />
                <Stack.Screen
                  name="json-render-smoke"
                  options={{ title: "json-render smoke" }}
                />
                <Stack.Screen
                  name="thread-samples"
                  options={{ title: "Thread samples" }}
                />
                <Stack.Screen
                  name="browser"
                  options={{
                    title: "Browser",
                    headerShown: false,
                    presentation: "modal",
                  }}
                />
              </Stack>
            </KeyboardProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </SubagentRunsProvider>
      </WorkspaceProvider>
    </ChatsProvider>
  );
}
