import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useDrawerProgress } from "expo-router/drawer";

import { usePearlScreenBackground } from "@/src/navigation-theme";

/**
 * Scene shell for Expo Router Drawer (`drawerType: "back"`).
 *
 * Children stay in a plain `View` — never under a Reanimated transform /
 * margin host. UIKit measures UINavigationBar safe area through ancestor
 * transforms; wrapping the nested stack broke Liquid Glass headers so they
 * sat under the Dynamic Island. The drawer still reveals this scene behind
 * the panel; we only dim while open.
 *
 * Nested back vs drawer swipe is locked from ScreenChrome via
 * useLockDrawerSwipeOnStackBack (setOptions on the drawer parent).
 */
export function DrawerScene({ children }: { readonly children: ReactNode }) {
  const progress = useDrawerProgress();
  const sheetFill = usePearlScreenBackground();

  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 1],
      [0, 0.08],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={styles.root}>
      <View style={[styles.sheet, { backgroundColor: sheetFill }]}>
        <View style={styles.content}>{children}</View>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            dimStyle,
            { backgroundColor: "#000" },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  sheet: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
