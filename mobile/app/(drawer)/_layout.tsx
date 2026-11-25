import { useWindowDimensions, View } from "react-native";
import { Drawer } from "expo-router/drawer";

import { DrawerPanel } from "@/components/navigation/drawer-panel";
import { PearlDrawerProvider } from "@/components/navigation/drawer-context";
import {
  usePearlDrawerBackground,
  usePearlHeaderTint,
  usePearlScreenBackground,
} from "@/src/navigation-theme";
import { ObserveInteractiveMarker } from "@/src/observe";

const MAX_PANEL_WIDTH = 320;

/**
 * Primary app destinations as Expo Router Drawer siblings. Custom panel
 * content + drawerType "back" keeps the ChatGPT-style reveal; nested stacks
 * under (home) / tasks / workspaces / settings own detail pushes.
 */
export default function DrawerLayout() {
  const { width: windowWidth } = useWindowDimensions();
  const panelWidth = Math.min(MAX_PANEL_WIDTH, Math.round(windowWidth * 0.82));
  const pageBackground = usePearlScreenBackground();
  const drawerBackground = usePearlDrawerBackground();
  const headerTintColor = usePearlHeaderTint();

  return (
    <PearlDrawerProvider>
      <ObserveInteractiveMarker />
      {/* Drawer color sits behind the scene so the scaled card's margin
          and rounded corners reveal it instead of the page fill. */}
      <View style={{ flex: 1, backgroundColor: drawerBackground }}>
        <Drawer
          drawerContent={(props) => (
            <DrawerPanel navigation={props.navigation} />
          )}
          screenOptions={{
            headerShown: true,
            headerShadowVisible: false,
            headerTintColor,
            headerStyle: { backgroundColor: pageBackground },
            drawerType: "back",
            overlayColor: "transparent",
            swipeEnabled: true,
            // Full-width L→R swipe opens the drawer (not edge-only).
            swipeEdgeWidth: windowWidth,
            // Screens own leading via ScreenChrome / nested Stack — avoid a
            // default drawer headerLeft stacking under those controls.
            headerLeft: () => null,
            drawerStyle: {
              width: panelWidth,
              backgroundColor: drawerBackground,
            },
            sceneStyle: {
              backgroundColor: "transparent",
            },
          }}
        >
          <Drawer.Screen
            name="(home)"
            options={{
              title: "",
              headerShown: false,
              drawerItemStyle: { display: "none" },
            }}
          />
          <Drawer.Screen
            name="tasks"
            options={{
              title: "Tasks",
              headerShown: false,
              drawerItemStyle: { display: "none" },
            }}
          />
          <Drawer.Screen
            name="goals"
            options={{
              title: "Goals",
              headerShown: false,
              drawerItemStyle: { display: "none" },
            }}
          />
          <Drawer.Screen
            name="notes"
            options={{
              title: "Notes",
              headerShown: false,
              drawerItemStyle: { display: "none" },
            }}
          />
          <Drawer.Screen
            name="library"
            options={{
              title: "Library",
              headerShown: false,
              drawerItemStyle: { display: "none" },
            }}
          />
          <Drawer.Screen
            name="workspaces"
            options={{
              title: "Projects",
              headerShown: false,
              drawerItemStyle: { display: "none" },
            }}
          />
          <Drawer.Screen
            name="finances"
            options={{
              title: "Finances",
              headerShown: false,
              drawerItemStyle: { display: "none" },
            }}
          />
          <Drawer.Screen
            name="history"
            options={{
              title: "History",
              headerShown: false,
              drawerItemStyle: { display: "none" },
            }}
          />
          <Drawer.Screen
            name="settings"
            options={{
              title: "Profile",
              headerShown: false,
              drawerItemStyle: { display: "none" },
            }}
          />
          <Drawer.Screen
            name="agent-directory"
            options={{
              title: "Directory",
              headerShown: false,
              drawerItemStyle: { display: "none" },
            }}
          />
          <Drawer.Screen
            name="issues/[id]"
            options={{
              drawerItemStyle: { display: "none" },
              headerShown: false,
            }}
          />
        </Drawer>
      </View>
    </PearlDrawerProvider>
  );
}
