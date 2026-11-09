import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SubagentRunsProvider } from "@/components/assistant-ui/elements/task-card.aui";
import { AuthProvider, useAuth } from "@/src/auth";
import { ChatsProvider } from "@/src/chat-context";
import {
  configureImageModelSelectionPersistence,
  configureModelSelectionPersistence,
  restoreImageModelSelection,
  restoreModelSelection,
} from "@/src/model-selection";
import {
  loadSavedImageModelSelection,
  loadSavedModelSelection,
  saveImageModelSelection,
  saveModelSelection,
} from "@/src/model-preferences";
import { WorkspaceProvider } from "@/src/workspace-context";

/** Keep the active chat mounted beneath pushed screens so its stream survives navigation. */
export default function RootLayout() {
  return <AuthProvider><AuthenticatedLayout /></AuthProvider>;
}

function AuthenticatedLayout() {
  const { signedIn, viewerEmail } = useAuth();
  useEffect(() => {
    configureModelSelectionPersistence(saveModelSelection);
    configureImageModelSelectionPersistence(saveImageModelSelection);
    void restoreModelSelection(loadSavedModelSelection).catch(() => {});
    void restoreImageModelSelection(loadSavedImageModelSelection).catch(() => {});
  }, []);
  // Dispose in-memory chat state whenever an account signs out or changes.
  const accountKey = signedIn ? `account:${viewerEmail}` : "signed-out";
  return (
    <ChatsProvider key={accountKey}>
      <WorkspaceProvider>
      <SubagentRunsProvider>
        <GestureHandlerRootView className="flex-1">
          <SafeAreaProvider>
            <KeyboardProvider enabled={Platform.OS === "ios" && !Platform.isPad}>
              <StatusBar style="auto" />
              <Stack>
                <Stack.Screen name="index" options={{ title: "Chat", headerShown: false }} />
                <Stack.Screen
                  name="history"
                  options={{
                    title: "History",
                    animation: Platform.OS === "ios" ? "slide_from_left" : "default",
                  }}
                />
                <Stack.Screen name="areas" options={{ title: "Areas" }} />
                <Stack.Screen name="projects/index" options={{ title: "Projects" }} />
                <Stack.Screen
                  name="projects/[id]/index"
                  options={{ title: "Project" }}
                />
                <Stack.Screen
                  name="projects/[id]/plans/[planId]"
                  options={{ title: "Plan" }}
                />
                <Stack.Screen name="issues" options={{ title: "Issues" }} />
                <Stack.Screen name="apps/index" options={{ title: "Apps" }} />
                <Stack.Screen
                  name="apps/[id]"
                  options={{ title: "App", headerShown: false }}
                />
                <Stack.Screen
                  name="settings"
                  options={{
                    title: "Settings",
                    presentation: "formSheet",
                    sheetAllowedDetents: [0.92],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 28,
                    // Content owns the title — native headers overlap formSheet scroll views.
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="skills"
                  options={{
                    title: "Skills",
                    presentation: "formSheet",
                    sheetAllowedDetents: [0.92],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 28,
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="plugins"
                  options={{
                    title: "Plugins",
                    presentation: "formSheet",
                    sheetAllowedDetents: [0.92],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 28,
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="models"
                  options={{
                    title: "Models",
                    presentation: "formSheet",
                    sheetAllowedDetents: [0.62, 0.92],
                    sheetInitialDetentIndex: 0,
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 28,
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="identity"
                  options={{
                    title: "Identity",
                    presentation: "formSheet",
                    sheetAllowedDetents: [0.92],
                    sheetGrabberVisible: true,
                    sheetCornerRadius: 28,
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="json-render-smoke"
                  options={{ title: "json-render smoke" }}
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
