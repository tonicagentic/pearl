import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextInputInstance,
} from "react-native";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { SearchIcon, XIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import { KeyboardController, useKeyboardHandler } from "react-native-keyboard-controller";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";

const CAN_USE_LIQUID_GLASS =
  Platform.OS === "ios" &&
  isGlassEffectAPIAvailable() &&
  isLiquidGlassAvailable();

const COMPOSER_EDGE = 16;
const COMPOSER_SHELL_RADIUS = 26;
const SEARCH_SHELL_HEIGHT = 52;
const DISMISS_SIZE = 52;
const DISMISS_GAP = 10;
const MORPH_MS = 280;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Persistent liquid-glass search dock.
 * Idle: full-width pill. Active: field shrinks and a glass X splits off the trailing edge
 * while the dock lifts with the keyboard (no remount).
 */
export function HistorySearchBar({
  active,
  value,
  onChangeText,
  onActivate,
  onClose,
}: {
  readonly active: boolean;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly onActivate: () => void;
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInputInstance>(null);
  const [reducedTransparency, setReducedTransparency] = useState(true);
  const [rowWidth, setRowWidth] = useState(0);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;

  const activeProgress = useSharedValue(0);
  const keyboardHeight = useSharedValue(
    KeyboardController.isVisible() ? KeyboardController.state().height : 0,
  );
  const restingPad = Math.max(insets.bottom, 12) + 4;

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
    activeProgress.value = withTiming(active ? 1 : 0, {
      duration: MORPH_MS,
      easing: Easing.out(Easing.cubic),
    });
    if (active) {
      inputRef.current?.focus();
    } else {
      inputRef.current?.blur();
    }
  }, [active, activeProgress]);

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

  const idleDockStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboardHeight.value, restingPad),
  }));

  const fieldStyle = useAnimatedStyle(() => {
    const dismissReserve = DISMISS_SIZE + DISMISS_GAP;
    const full = rowWidth > 0 ? rowWidth : 1;
    const narrowed = Math.max(0, full - dismissReserve);
    return {
      width: interpolate(
        activeProgress.value,
        [0, 1],
        [full, narrowed],
        Extrapolation.CLAMP,
      ),
    };
  });

  const dismissStyle = useAnimatedStyle(() => {
    // Start overlapped on the pill's trailing edge, then settle into the gap.
    const tuckIntoPill = -(DISMISS_SIZE * 0.28);
    return {
      opacity: interpolate(
        activeProgress.value,
        [0, 0.2, 1],
        [0, 0.85, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateX: interpolate(
            activeProgress.value,
            [0, 1],
            [tuckIntoPill, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(
            activeProgress.value,
            [0, 1],
            [0.82, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const glass = CAN_USE_LIQUID_GLASS && !reducedTransparency;

  const onRowLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && Math.abs(next - rowWidth) > 0.5) {
      setRowWidth(next);
    }
  };

  const glassOrFallback = (radius: number) =>
    glass ? (
      <GlassView
        pointerEvents="none"
        glassEffectStyle="regular"
        style={[styles.surface, { borderRadius: radius }]}
      />
    ) : (
      <View
        pointerEvents="none"
        className="border-border/60 bg-card absolute inset-0 border"
        style={{ borderRadius: radius }}
      />
    );

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.dock,
        { paddingHorizontal: COMPOSER_EDGE },
        active
          ? { top: insets.top + 8 }
          : [styles.dockBottom, idleDockStyle],
      ]}
    >
      <View style={styles.row} onLayout={onRowLayout}>
        <Animated.View
          style={[
            styles.fieldShell,
            rowWidth > 0 ? fieldStyle : styles.fieldShellFill,
          ]}
        >
          {glassOrFallback(COMPOSER_SHELL_RADIUS)}
          <Pressable
            accessibilityRole="search"
            accessibilityLabel="Search chats"
            disabled={active}
            onPress={onActivate}
            style={styles.fieldHit}
          >
            <Icon as={SearchIcon} className="size-5 text-muted-foreground" />
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              editable={active}
              pointerEvents={active ? "auto" : "none"}
              placeholder="Search chats"
              placeholderTextColor={placeholderColor}
              accessibilityLabel="Search chats"
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              onFocus={() => {
                if (!active) onActivate();
              }}
              style={[styles.input, { color: foregroundColor }]}
            />
          </Pressable>
        </Animated.View>

        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel="Close search"
          onPress={onClose}
          pointerEvents={active ? "auto" : "none"}
          style={[styles.dismissShell, styles.dismissAbsolute, dismissStyle]}
        >
          {glassOrFallback(DISMISS_SIZE / 2)}
          <View style={styles.dismissIcon}>
            <Icon as={XIcon} className="size-5 text-foreground" />
          </View>
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

/** Space the search results list should leave clear under the top dock. */
export const HISTORY_SEARCH_DOCK_CLEARANCE =
  SEARCH_SHELL_HEIGHT + COMPOSER_EDGE;

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 50,
  },
  dockBottom: {
    bottom: 0,
  },
  row: {
    height: SEARCH_SHELL_HEIGHT,
    justifyContent: "center",
  },
  fieldShell: {
    height: SEARCH_SHELL_HEIGHT,
    borderRadius: COMPOSER_SHELL_RADIUS,
    overflow: "hidden",
    justifyContent: "center",
  },
  fieldShellFill: {
    width: "100%",
  },
  fieldHit: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    height: SEARCH_SHELL_HEIGHT,
  },
  surface: {
    ...StyleSheet.absoluteFill,
  },
  input: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    paddingVertical: 0,
  },
  dismissShell: {
    width: DISMISS_SIZE,
    height: DISMISS_SIZE,
    borderRadius: DISMISS_SIZE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  dismissAbsolute: {
    position: "absolute",
    right: 0,
    top: 0,
  },
  dismissIcon: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
});
