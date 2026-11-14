import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SubagentRunsProvider } from "@/components/assistant-ui/elements/task-card.aui";
import { PushNotificationsBridge } from "@/components/push-notifications-bridge";
import { applyUpdatesOnLaunch } from "@/src/apply-updates";
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

/** Prefer Mail home when the router has no deeper path to restore. */
export const unstable_settings = {
  initialRouteName: "(home)",
};

/** Root stack: auth gates, then Mail-style home (chat/settings live inside). */
export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthenticatedLayout />
    </AuthProvider>
  );
}

function AuthenticatedLayout() {
  const { signedIn, billingReady, viewerEmail } = useAuth();
  useEffect(() => {
    configureModelSelectionPersistence(saveModelSelection);
    configureImageModelSelectionPersistence(saveImageModelSelection);
    configureVectorModelSelectionPersistence(saveVectorModelSelection);
    void restoreModelSelection(loadSavedModelSelection).catch(() => {});
    void restoreImageModelSelection(loadSavedImageModelSelection).catch(
      () => {},
    );
    void restoreVectorModelSelection(loadSavedVectorModelSelection).catch(
      () => {},
    );
    void applyUpdatesOnLaunch();
  }, []);
  // Dispose in-memory chat state whenever an account signs out or changes.
  const accountKey = signedIn ? `account:${viewerEmail}` : "signed-out";
  // Keep at least one Stack.Protected guard true while the session restores
  // (otherwise Expo Router warns that every route is protected).
  const signedOut = !signedIn;
  const needsBilling = signedIn && !billingReady;
  const appReady = signedIn && billingReady;

  return (
    <ChatsProvider key={accountKey}>
      <WorkspaceProvider>
        <SubagentRunsProvider>
          <PushNotificationsBridge />
          <GestureHandlerRootView className="flex-1">
            <SafeAreaProvider>
              <KeyboardProvider
                enabled={Platform.OS === "ios" && !Platform.isPad}
              >
                <StatusBar style="auto" />
                <Stack>
                  <Stack.Protected guard={signedOut}>
                    <Stack.Screen
                      name="sign-in"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="reset-password"
                      options={{
                        title: "Reset password",
                        headerShown: true,
                        headerBackButtonDisplayMode: "minimal",
                      }}
                    />
                  </Stack.Protected>

                  <Stack.Protected guard={needsBilling}>
                    <Stack.Screen
                      name="billing"
                      options={{ headerShown: false }}
                    />
                  </Stack.Protected>

                  <Stack.Protected guard={appReady}>
                    <Stack.Screen
                      name="(home)"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="history"
                      options={{
                        title: "History",
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="repos"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="workbench/index"
                      options={{
                        title: "Repos",
                        headerShown: true,
                        headerBackButtonDisplayMode: "minimal",
                      }}
                    />
                    <Stack.Screen
                      name="workbench/[id]"
                      options={{
                        title: "Repo",
                        headerShown: true,
                        headerBackButtonDisplayMode: "minimal",
                      }}
                    />
                    <Stack.Screen
                      name="areas"
                      options={{
                        title: "Areas",
                        headerShown: true,
                        headerBackButtonDisplayMode: "minimal",
                      }}
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
                      name="identity"
                      options={{ title: "Identity", headerShown: true }}
                    />
                    <Stack.Screen
                      name="memory"
                      options={{ title: "Memory", headerShown: true }}
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
                      name="about"
                      options={{ title: "About", headerShown: true }}
                    />
                    <Stack.Screen
                      name="self-host"
                      options={{ title: "Self-host", headerShown: true }}
                    />
                    <Stack.Protected guard={__DEV__}>
                      <Stack.Screen
                        name="json-render-smoke"
                        options={{ title: "json-render smoke" }}
                      />
                      <Stack.Screen
                        name="thread-samples"
                        options={{
                          title: "Thread samples",
                          headerShown: true,
                          headerBackButtonDisplayMode: "minimal",
                        }}
                      />
                    </Stack.Protected>
                    <Stack.Screen
                      name="browser"
                      options={{
                        title: "Browser",
                        headerShown: false,
                        presentation: "modal",
                      }}
                    />
                  </Stack.Protected>
                </Stack>
              </KeyboardProvider>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </SubagentRunsProvider>
      </WorkspaceProvider>
    </ChatsProvider>
  );
}
