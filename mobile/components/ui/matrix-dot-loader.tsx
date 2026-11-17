import { useEffect, useState } from "react";
import { AccessibilityInfo, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

/** transitions.dev matrix-dot-loader — scan variant delays (col * cycle/10). */
const CYCLE_MS = 1200;
const DOT = 2;
const GAP = 2;
const COLS = 4;
const SIZE = COLS * DOT + (COLS - 1) * GAP;

const SCAN_DELAYS_MS = Array.from(
  { length: COLS * COLS },
  (_, index) => (index % COLS) * (CYCLE_MS / 10),
);

type MatrixDotLoaderProps = {
  readonly baseColor?: string;
  readonly activeColor?: string;
  readonly style?: ViewStyle;
};

/**
 * 4×4 matrix pulse for Recents "working" presence. Ports the free
 * transitions.dev matrix-dot-loader (scan) to Reanimated.
 */
export function MatrixDotLoader({
  baseColor = "#d9d9d9",
  activeColor = "#85858f",
  style,
}: MatrixDotLoaderProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        {
          width: SIZE,
          height: SIZE,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: GAP,
        },
        style,
      ]}
    >
      {SCAN_DELAYS_MS.map((delay, index) =>
        reduceMotion ? (
          <View
            key={index}
            style={{
              width: DOT,
              height: DOT,
              backgroundColor: baseColor,
            }}
          />
        ) : (
          <MatrixDot
            key={index}
            delayMs={delay}
            baseColor={baseColor}
            activeColor={activeColor}
          />
        ),
      )}
    </View>
  );
}

function MatrixDot({
  delayMs,
  baseColor,
  activeColor,
}: {
  readonly delayMs: number;
  readonly baseColor: string;
  readonly activeColor: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: CYCLE_MS * 0.15,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, {
            duration: CYCLE_MS * 0.3,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, { duration: CYCLE_MS * 0.55 }),
        ),
        -1,
        false,
      ),
    );
  }, [delayMs, progress]);

  // Color mix has to stay inside the worklet. Calling a JS helper from
  // useAnimatedStyle throws on the UI runtime and takes the app down.
  const style = useAnimatedStyle(() => {
    return {
      width: DOT,
      height: DOT,
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        [baseColor, activeColor],
      ),
    };
  }, [baseColor, activeColor]);

  return <Animated.View style={style} />;
}

/** Layout slot matching the matrix so idle/waiting/unread columns align. */
export const MATRIX_DOT_LOADER_SIZE = SIZE;
