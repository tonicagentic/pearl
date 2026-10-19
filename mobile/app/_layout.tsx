import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SubagentRunsProvider } from "@/components/assistant-ui/elements/task-card.aui";
import { AuthProvider, useAuth } from "@/src/auth";
import { ChatsProvider } from "@/src/chat-context";

/** Keep the active chat mounted beneath pushed screens so its stream survives navigation. */
export default function RootLayout() {
  return <AuthProvider><AuthenticatedLayout /></AuthProvider>;
}

function AuthenticatedLayout() {
  const { signedIn, viewerEmail } = useAuth();
  // Dispose in-memory chat state whenever an account signs out or changes.
  const accountKey = signedIn ? `account:${viewerEmail}` : "signed-out";
  return (
    <ChatsProvider key={accountKey}>
      <SubagentRunsProvider>
        <GestureHandlerRootView className="flex-1">
          <SafeAreaProvider>
            <KeyboardProvider enabled={Platform.OS === "ios" && !Platform.isPad}>
              <StatusBar style="auto" />
              <Stack>
                <Stack.Screen name="index" options={{ title: "Chat", headerShown: false }} />
                <Stack.Screen name="history" options={{ title: "History" }} />
                <Stack.Screen name="areas" options={{ title: "Areas" }} />
                <Stack.Screen name="issues" options={{ title: "Issues" }} />
              </Stack>
            </KeyboardProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </SubagentRunsProvider>
    </ChatsProvider>
  );
}
