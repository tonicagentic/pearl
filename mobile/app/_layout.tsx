import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Platform, View } from "react-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "@/src/keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BootReveal } from "@/components/boot-fade-overlay";
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
import {
  usePearlHeaderTint,
  usePearlNavigationTheme,
  usePearlScreenBackground,
} from "@/src/navigation-theme";
import { NetworkStatusProvider } from "@/src/network-status";
import { Observe, ObserveRoot, observeAvailable } from "@/src/observe";
import { QueryProvider } from "@/src/query-client";
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

/** Prefer New Chat when the router has no deeper path to restore. */
export const unstable_settings = {
  initialRouteName: "(drawer)",
};

/** Root stack: auth gates, then drawer-first app destinations. */
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
  const navigationTheme = usePearlNavigationTheme();
  const backgroundColor = usePearlScreenBackground();
  const headerTintColor = usePearlHeaderTint();
  // iOS: omit headerStyle so the system Liquid Glass bar paints.
  const headerStyle =
    Platform.OS === "ios" ? undefined : { backgroundColor };
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

  // Native splash stays up while restoring. Once BootReveal mounts, drop the
  // native splash so the JS sequence (logo out → app in) takes over.
  useEffect(() => {
    if (restoring) return;
    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => {});
    });
    return () => cancelAnimationFrame(frame);
  }, [restoring]);

  // Dispose in-memory chat state whenever an account signs out or changes.
  const hasAccount = signedIn && !isAnonymous;
  const accountKey = hasAccount ? `account:${viewerEmail}` : "signed-out";
  // Keep at least one Stack.Protected guard true while the session restores
  // (otherwise Expo Router warns that every route is protected).
  const signedOut = !hasAccount;
  // Billing is an empty-state on chats, not a Stack lock — Profile and other
  // tabs stay reachable while checkout is pending.
  const appReady = hasAccount;

  return (
    <NetworkStatusProvider>
      <QueryProvider accountKey={accountKey}>
        <ChatsProvider key={accountKey}>
          <WorkspaceProvider>
            <PushNotificationsBridge />
            <GestureHandlerRootView
              className="flex-1"
              style={{ backgroundColor }}
            >
              <SafeAreaProvider>
                <KeyboardProvider
                  enabled={Platform.OS === "ios" && !Platform.isPad}
                >
                  <StatusBar style="auto" />
                  {restoring ? (
                    // Don't mount the navigator until we know the zone — otherwise
                    // restore paints sign-in then pushes (home), and the nav chrome
                    // slides in with the default stack animation. Native splash
                    // still covers this until hideAsync runs.
                    <View style={{ flex: 1, backgroundColor }} />
                  ) : (
                    <BootReveal>
                      <ThemeProvider value={navigationTheme}>
                      <Stack
                    // Remount per auth zone so home is the initial route, not a
                    // push on top of sign-in (animation: "none" alone is ignored
                    // for Protected guard swaps on iOS native-stack).
                    key={hasAccount ? "app" : "auth"}
                    screenOptions={({ route }) =>
                      route.name === "(drawer)" || route.name === "sign-in"
                        ? {
                            animation: "none",
                            animationTypeForReplace: "pop",
                            contentStyle: { backgroundColor },
                            ...(headerStyle ? { headerStyle } : {}),
                            headerTintColor,
                          }
                        : {
                            contentStyle: { backgroundColor },
                            ...(headerStyle ? { headerStyle } : {}),
                            headerTintColor,
                          }
                    }
                  >
                    <Stack.Protected
                      guard={signedOut}
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
                      <Stack.Screen
                        name="thread-inspector"
                        options={{
                          title: "RN Thread Inspector",
                          headerShown: true,
                          headerBackButtonDisplayMode: "minimal",
                        }}
                      />
                      <Stack.Screen
                        name="asc-iap"
                        options={{
                          title: "Billing",
                          headerShown: true,
                          headerBackButtonDisplayMode: "minimal",
                        }}
                      />
                    </Stack.Protected>

                    <Stack.Protected guard={appReady} redirectTo="/sign-in">
                      <Stack.Screen
                        name="(drawer)"
                        options={{
                          headerShown: false,
                          animation: "none",
                          animationTypeForReplace: "pop",
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
                  </ThemeProvider>
                </BootReveal>
              )}
            </KeyboardProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
          </WorkspaceProvider>
        </ChatsProvider>
      </QueryProvider>
    </NetworkStatusProvider>
  );
}
