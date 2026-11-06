import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import type { AuthCtaFrame } from "@/src/auth";

/** Match the floating iOS composer dock in thread.aui.tsx. */
const COMPOSER_EDGE = 16;
const COMPOSER_SHELL_RADIUS = 26;
const COMPOSER_SHELL_HEIGHT = 108;
const MORPH_MS = 560;

/**
 * Absolute overlay that morphs the auth CTA pill into the chat composer shell,
 * then calls `onComplete` so the real composer can take over.
 */
export function AuthToChatMorph({
  from,
  onComplete,
}: {
  readonly from: AuthCtaFrame;
  readonly onComplete: () => void;
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  const primary = useCSSVariable("--color-primary") as string | undefined;
  const card = useCSSVariable("--color-card") as string | undefined;
  const muted = useCSSVariable("--color-muted") as string | undefined;
  const fromColor = primary ?? "#111114";
  const toColor = card ?? muted ?? "#F4F4F5";

  const target = {
    x: COMPOSER_EDGE,
    y:
      windowHeight -
      insets.bottom -
      COMPOSER_EDGE -
      COMPOSER_SHELL_HEIGHT,
    width: Math.max(0, windowWidth - COMPOSER_EDGE * 2),
    height: COMPOSER_SHELL_HEIGHT,
  };

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: MORPH_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(onComplete)();
        }
      },
    );
  }, [onComplete, progress]);

  const shellStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      position: "absolute",
      left: interpolate(t, [0, 1], [from.x, target.x]),
      top: interpolate(t, [0, 1], [from.y, target.y]),
      width: interpolate(t, [0, 1], [from.width, target.width]),
      height: interpolate(t, [0, 1], [from.height, target.height]),
      borderRadius: interpolate(
        t,
        [0, 1],
        [from.height / 2, COMPOSER_SHELL_RADIUS],
      ),
      backgroundColor: interpolateColor(t, [0, 1], [fromColor, toColor]),
    };
  });

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35], [1, 0], "clamp"),
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={shellStyle}>
        <Animated.View
          style={[
            {
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            },
            labelStyle,
          ]}
        >
          <Animated.Text
            style={{
              color: "#FFFFFF",
              fontSize: 17,
              fontWeight: "600",
            }}
          >
            Welcome
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
