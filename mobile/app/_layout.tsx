import { Drawer } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppDrawer } from "@/components/app-drawer";
import { SubagentRunsProvider } from "@/components/assistant-ui/elements/task-card.aui";
import { AuthProvider } from "@/src/auth";
import { ChatsProvider } from "@/src/chat-context";

/**
 * Root layout: auth + chats context, then a drawer navigator whose content
 * mirrors the web app's sidebar (New chat, Issues, chat threads, account).
 * Screens render their own headers, so the drawer's built-in header is off.
 */
export default function RootLayout() {
  return (
    <AuthProvider>
      <ChatsProvider>
        <SubagentRunsProvider>
        <GestureHandlerRootView className="flex-1">
          <SafeAreaProvider>
            <StatusBar style="auto" />
            <Drawer
              screenOptions={{
                headerShown: false,
                swipeEnabled: true,
                drawerType: "slide",
              }}
              drawerContent={(props) => <AppDrawer {...props} />}
            >
              <Drawer.Screen name="index" options={{ title: "Chat" }} />
              <Drawer.Screen name="issues" options={{ title: "Issues" }} />
            </Drawer>
          </SafeAreaProvider>
        </GestureHandlerRootView>
        </SubagentRunsProvider>
      </ChatsProvider>
    </AuthProvider>
  );
}
