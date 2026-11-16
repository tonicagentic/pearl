import { useEffect, type ComponentRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import {
  KeyboardController,
  useKeyboardHandler,
} from "react-native-keyboard-controller";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { HOME_COMPOSER_CLEARANCE } from "@/components/home/home-composer-dock";
import { Text } from "@/components/ui/text";
import { EXAMPLE_PROMPTS } from "@/src/example-prompts";

const MORPH_MS = 280;

/**
 * Search-style overlay above the home composer: example prompt chips fade in
 * while the field stays docked at the bottom.
 */
export function ComposeOverlay({
  visible,
  onPick,
  chipsRef,
}: {
  readonly visible: boolean;
  readonly onPick: (prompt: string) => void;
  readonly chipsRef?: React.RefObject<ComponentRef<typeof View> | null>;
}) {
  const insets = useSafeAreaInsets();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const cardColor = useCSSVariable("--color-card") as string | undefined;
  const borderColor = useCSSVariable("--color-border") as string | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;

  const visibleProgress = useSharedValue(0);
  const keyboardHeight = useSharedValue(
    KeyboardController.isVisible() ? KeyboardController.state().height : 0,
  );
  const restingPad = Math.max(insets.bottom, 12) + 4;

  useEffect(() => {
    visibleProgress.value = withTiming(visible ? 1 : 0, {
      duration: MORPH_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, visibleProgress]);

  useKeyboardHandler({
    onStart: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
    onMove: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
    onInteractive: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
    onEnd: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
  });

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      visibleProgress.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          visibleProgress.value,
          [0, 1],
          [12, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const padStyle = useAnimatedStyle(() => ({
    paddingBottom:
      Math.max(keyboardHeight.value, restingPad) + HOME_COMPOSER_CLEARANCE + 16,
  }));

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[styles.root, { backgroundColor }, overlayStyle]}
    >
      <Animated.View style={[styles.body, padStyle]}>
        <Text variant="title" className="px-1 pb-3">
          Try one of these
        </Text>
        <View
          ref={chipsRef}
          collapsable={false}
          style={styles.chips}
        >
          {EXAMPLE_PROMPTS.map((prompt) => (
            <Pressable
              key={prompt}
              accessibilityRole="button"
              accessibilityLabel={prompt}
              onPress={() => onPick(prompt)}
              style={[
                styles.chip,
                {
                  backgroundColor: cardColor,
                  borderColor: borderColor ?? "transparent",
                },
              ]}
            >
              <Text
                variant="secondary"
                numberOfLines={2}
                style={foregroundColor ? { color: foregroundColor } : undefined}
              >
                {prompt}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  body: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 72,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "100%",
  },
});
