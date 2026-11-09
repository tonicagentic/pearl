import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
} from "react-native";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { SearchIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";

const CAN_USE_LIQUID_GLASS =
  Platform.OS === "ios" &&
  isGlassEffectAPIAvailable() &&
  isLiquidGlassAvailable();

/** Match the floating iOS composer dock. */
const COMPOSER_EDGE = 16;
const COMPOSER_SHELL_RADIUS = 26;
const SEARCH_SHELL_HEIGHT = 52;

/**
 * Bottom glass search field that morphs in with history openProgress,
 * standing in for the composer shell on the navigation root.
 */
export function HistorySearchBar({
  openProgress,
  value,
  onChangeText,
  active,
}: {
  openProgress: SharedValue<number>;
  value: string;
  onChangeText: (text: string) => void;
  /** Settled open — focus after the push settles. */
  active: boolean;
}) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInputInstance>(null);
  const [reducedTransparency, setReducedTransparency] = useState(true);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;

  useEffect(() => {
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReducedTransparency,
    );
    void AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => {
        if (mounted) setReducedTransparency(enabled);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!active) {
      inputRef.current?.blur();
      return;
    }
    const timer = setTimeout(() => {
      // Soft focus after settle so the push spring is not fighting the keyboard.
    }, 0);
    return () => clearTimeout(timer);
  }, [active]);

  const glass = CAN_USE_LIQUID_GLASS && !reducedTransparency;
  const dockStyle = useAnimatedStyle(() => {
    const t = openProgress.value;
    return {
      opacity: interpolate(t, [0.35, 0.75, 1], [0, 0.55, 1]),
      transform: [
        {
          translateY: interpolate(t, [0.35, 1], [24, 0]),
        },
        {
          scale: interpolate(t, [0.35, 1], [0.96, 1]),
        },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents={active ? "box-none" : "none"}
      style={[
        styles.dock,
        {
          paddingBottom: Math.max(insets.bottom, 12) + 4,
          paddingHorizontal: COMPOSER_EDGE,
        },
        dockStyle,
      ]}
    >
      <View style={styles.shell}>
        {glass ? (
          <GlassView
            pointerEvents="none"
            glassEffectStyle="regular"
            style={styles.surface}
          />
        ) : (
          <View
            pointerEvents="none"
            className="border-border/60 bg-card absolute inset-0 border"
            style={{ borderRadius: COMPOSER_SHELL_RADIUS }}
          />
        )}
        <View style={styles.row}>
          <Icon as={SearchIcon} className="size-5 text-muted-foreground" />
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            placeholder="Search chats"
            placeholderTextColor={placeholderColor}
            accessibilityLabel="Search chats"
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoCapitalize="none"
            style={[styles.input, { color: foregroundColor }]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  shell: {
    height: SEARCH_SHELL_HEIGHT,
    borderRadius: COMPOSER_SHELL_RADIUS,
    overflow: "hidden",
    justifyContent: "center",
  },
  surface: {
    ...StyleSheet.absoluteFill,
    borderRadius: COMPOSER_SHELL_RADIUS,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    height: SEARCH_SHELL_HEIGHT,
  },
  input: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    paddingVertical: 0,
  },
});
