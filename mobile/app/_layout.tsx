import { Drawer } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppDrawer } from "@/components/app-drawer";
import { AuthProvider } from "@/src/auth";

/**
 * Root layout: auth context + a drawer navigator whose content mirrors the
 * web app's sidebar (New session, Issues, chat threads, account). Screens
 * render their own headers, so the drawer's built-in header is off.
 */
export default function RootLayout() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
