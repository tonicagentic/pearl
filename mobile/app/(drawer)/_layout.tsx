import { useWindowDimensions, View } from "react-native";
import { Drawer } from "expo-router/drawer";

import { DrawerPanel } from "@/components/navigation/drawer-panel";
import { usePearlDrawer } from "@/components/navigation/drawer-context";
import { usePearlDrawerBackground } from "@/src/navigation-theme";
import { ObserveInteractiveMarker } from "@/src/observe";

const MAX_PANEL_WIDTH = 320;

/**
 * Reads swipe lock from PearlDrawerProvider (set by nested stack screens
 * via useLockDrawerSwipeOnStackBack) so the Drawer re-renders with the
 * gesture actually disabled — setOptions alone was not reliable here.
 */
function PearlDrawerNavigator() {
  const { width: windowWidth } = useWindowDimensions();
  const panelWidth = Math.min(MAX_PANEL_WIDTH, Math.round(windowWidth * 0.82));
  const drawerBackground = usePearlDrawerBackground();
  const { swipeEnabled } = usePearlDrawer();

  return (
    <Drawer
      drawerContent={(props) => (
        <DrawerPanel navigation={props.navigation} />
      )}
      screenOptions={{
        headerShown: false,
        drawerType: "back",
        overlayColor: "transparent",
        swipeEnabled,
        // Full-width L→R when unlocked; zero edge while a stack can go back.
        swipeEdgeWidth: swipeEnabled ? windowWidth : 0,
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
        name="agents"
        options={{
          title: "Agents",
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
        name="automations"
        options={{
          title: "Automations",
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
  );
}

/**
 * Primary app destinations as Expo Router Drawer siblings. Custom panel
 * content + drawerType "back" keeps the ChatGPT-style reveal; nested stacks
 * under (home) / tasks / workspaces own detail pushes. Settings is a
 * root fullScreenModal so it can overlay an open drawer.
 * Drawer header stays off — nested stacks own native Liquid Glass chrome.
 */
export default function DrawerLayout() {
  const drawerBackground = usePearlDrawerBackground();

  return (
    <>
      <ObserveInteractiveMarker />
      {/* Drawer color sits behind the scene so the scaled card's margin
          and rounded corners reveal it instead of the page fill.
          DrawerOpenSync lives under (home)/_layout so useDrawerStatus is valid. */}
      <View style={{ flex: 1, backgroundColor: drawerBackground }}>
        <PearlDrawerNavigator />
      </View>
    </>
  );
}
