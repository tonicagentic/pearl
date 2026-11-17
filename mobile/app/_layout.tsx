import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { ObserveErrorFallback } from "@/components/observe-error-fallback";
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
import { Observe, ObserveRoot, observeAvailable } from "@/src/observe";
import { WorkspaceProvider } from "@/src/workspace-context";

function agentHostnameForTraces(): string | null {
  const raw = process.env.EXPO_PUBLIC_AGENT_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname || null;
  } catch {
    return null;
  }
}

if (observeAvailable) {
  const observeNetworkHost = agentHostnameForTraces();
  Observe.configure({
    integrations: {
      "expo-router": {
        filteredParams: ["token", "url", "error"],
      },
    },
    networkTraces: observeNetworkHost
      ? { filter: { hosts: [observeNetworkHost] } }
      : false,
  });
}

/** Prefer Mail home when the router has no deeper path to restore. */
export const unstable_settings = {
  initialRouteName: "(home)",
};

/** Root stack: auth gates, then Mail-style home (chat/settings live inside). */
export default function RootLayout() {
  return (
    <ObserveRoot
      errorBoundaryFallback={({ resetError }) => (
        <ObserveErrorFallback resetError={resetError} />
      )}
    >
      <AuthProvider>
        <AuthenticatedLayout />
      </AuthProvider>
    </ObserveRoot>
  );
}

function AuthenticatedLayout() {
  const { isAnonymous, signedIn, restoring, viewerEmail } = useAuth();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
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
  // Billing is an empty-state on chats, not a Stack lock — Profile and other
  // tabs stay reachable while checkout is pending.
  const appReady = signedIn;

  return (
    <ChatsProvider key={accountKey}>
      <WorkspaceProvider>
        <PushNotificationsBridge />
        <GestureHandlerRootView className="flex-1">
          <SafeAreaProvider>
            <KeyboardProvider
              enabled={Platform.OS === "ios" && !Platform.isPad}
            >
              <StatusBar style="auto" />
              {restoring ? (
                // Don't mount the navigator until we know the zone — otherwise
                // restore paints sign-in then pushes (home), and the nav chrome
                // slides in with the default stack animation.
                <View style={{ flex: 1, backgroundColor }} />
              ) : (
                <Stack
                  // Remount per auth zone so home is the initial route, not a
                  // push on top of sign-in (animation: "none" alone is ignored
                  // for Protected guard swaps on iOS native-stack).
                  // Guests stay on home; sign-in stays registered so Profile
                  // can push it without dropping the guest session.
                  key={signedIn ? "app" : "auth"}
                  screenOptions={({ route }) =>
                    route.name === "(home)" || route.name === "sign-in"
                      ? {
                          animation: "none",
                          animationTypeForReplace: "pop",
                        }
                      : {}
                  }
                >
                  <Stack.Protected
                    guard={signedOut || isAnonymous}
                    redirectTo="/"
                  >
                    <Stack.Screen
                      name="sign-in"
                      options={{
                        headerShown: false,
                        animation: "none",
                        gestureEnabled: true,
                      }}
                    />
                  </Stack.Protected>
                  <Stack.Protected guard={signedOut} redirectTo="/">
                    <Stack.Screen
                      name="reset-password"
                      options={{
                        title: "Reset password",
                        headerShown: true,
                        headerBackButtonDisplayMode: "minimal",
                      }}
                    />
                  </Stack.Protected>

                  <Stack.Protected guard={appReady} redirectTo="/sign-in">
                    <Stack.Screen
                      name="(home)"
                      options={{
                        headerShown: false,
                        animation: "none",
                        animationTypeForReplace: "pop",
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
                      name="billing"
                      options={{ headerShown: false }}
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
                    {/* Reachable via pearl:///stream-playground; Settings gates
                        visibility to __DEV__ or unlocked internal builds. */}
                    <Stack.Screen
                      name="stream-playground"
                      options={{
                        title: "Stream playground",
                        headerShown: true,
                        headerBackButtonDisplayMode: "minimal",
                      }}
                    />
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
              )}
            </KeyboardProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </WorkspaceProvider>
    </ChatsProvider>
  );
}
