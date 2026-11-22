import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useDrawerProgress } from "expo-router/drawer";
import { useCSSVariable } from "uniwind";

/** Rounded peek card (ChatGPT-style). */
const SHEET_RADIUS = 38;
const DRAWER_SCALE_FROM = 0.96;

/**
 * Progress-driven scene chrome for Expo Router Drawer (`drawerType: "back"`):
 * rounded peek card + light scale as the panel is revealed behind.
 * Wrap each drawer destination (or its nested stack layout).
 */
export function DrawerScene({ children }: { readonly children: ReactNode }) {
  const progress = useDrawerProgress();
  const pageBackground = useCSSVariable("--color-background") as
    | string
    | undefined;
  const sheetFill = pageBackground ?? "#FFFFFF";

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [1, DRAWER_SCALE_FROM],
          Extrapolation.CLAMP,
        ),
      },
    ],
    borderTopLeftRadius: interpolate(
      progress.value,
      [0, 1],
      [0, SHEET_RADIUS],
      Extrapolation.CLAMP,
    ),
    borderBottomLeftRadius: interpolate(
      progress.value,
      [0, 1],
      [0, SHEET_RADIUS],
      Extrapolation.CLAMP,
    ),
    borderTopRightRadius: interpolate(
      progress.value,
      [0, 1],
      [0, SHEET_RADIUS],
      Extrapolation.CLAMP,
    ),
    borderBottomRightRadius: interpolate(
      progress.value,
      [0, 1],
      [0, SHEET_RADIUS],
      Extrapolation.CLAMP,
    ),
    overflow: "hidden" as const,
    shadowOpacity: interpolate(
      progress.value,
      [0, 1],
      [0, 0.12],
      Extrapolation.CLAMP,
    ),
  }));

  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 1],
      [0, 0.08],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={[styles.root, { backgroundColor: sheetFill }]}>
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: sheetFill,
            shadowColor: "#000",
            shadowRadius: 20,
            shadowOffset: { width: -4, height: 0 },
            elevation: 6,
          },
          sheetStyle,
        ]}
      >
        <View style={styles.content}>{children}</View>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            dimStyle,
            { backgroundColor: "#000" },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  sheet: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
