import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CheckIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";

const FILL_MS = 200;
const HOLD_MS = 180;

/**
 * Things-style complete control: haptic + fill/scale, then notify parent
 * after a short hold so the row can exit.
 */
export function TaskCompleteControl({
  resolved,
  busy,
  onComplete,
  onReopen,
}: {
  readonly resolved: boolean;
  readonly busy: boolean;
  readonly onComplete: () => void;
  readonly onReopen: () => void;
}) {
  const [animating, setAnimating] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const scale = useSharedValue(1);
  const fill = useSharedValue(resolved ? 1 : 0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const primaryColor = useCSSVariable("--color-primary") as string | undefined;

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      cancelled = true;
      sub?.remove?.();
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!animating) {
      fill.value = resolved ? 1 : 0;
    }
  }, [resolved, animating, fill]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.55 + fill.value * 0.45 }],
  }));

  const press = () => {
    if (busy || animating) return;
    if (resolved) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => {},
      );
      onReopen();
      return;
    }

    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});

    if (reduceMotion) {
      onComplete();
      return;
    }

    setAnimating(true);
    fill.value = withTiming(1, { duration: FILL_MS });
    scale.value = withSequence(
      withTiming(1.12, { duration: FILL_MS / 2 }),
      withTiming(1, { duration: FILL_MS / 2 }),
    );
    holdTimer.current = setTimeout(() => {
      setAnimating(false);
      onComplete();
    }, FILL_MS + HOLD_MS);
  };

  const showCheck = resolved || animating;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={resolved ? "Reopen task" : "Complete task"}
      disabled={busy || animating}
      onPress={press}
      hitSlop={8}
    >
      <Animated.View
        style={ringStyle}
        className={`mt-0.5 h-7 w-7 items-center justify-center rounded-full border ${
          showCheck
            ? "border-transparent"
            : "border-foreground/30 bg-transparent"
        }`}
      >
        <Animated.View
          style={[
            fillStyle,
            {
              position: "absolute",
              inset: 0,
              borderRadius: 999,
              backgroundColor: primaryColor ?? "#3B82F6",
            },
          ]}
        />
        {busy && !animating ? (
          <ActivityIndicator
            size="small"
            color={placeholderColor ?? undefined}
          />
        ) : showCheck ? (
          <View className="z-10">
            <Icon as={CheckIcon} className="size-4 text-primary-foreground" />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
