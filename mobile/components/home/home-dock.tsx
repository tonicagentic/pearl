import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
} from "react-native";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { MicIcon, SearchIcon, SquarePenIcon, XIcon } from "lucide-react-native";
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

import { Icon } from "@/components/ui/icon";
import { Text, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const CAN_USE_LIQUID_GLASS =
  Platform.OS === "ios" &&
  isGlassEffectAPIAvailable() &&
  isLiquidGlassAvailable();

const EDGE = 16;
const SEARCH_HEIGHT = 52;
const COMPOSE_SIZE = 52;
const GAP = 10;
const MORPH_MS = 280;

/** List padding so rows clear the floating dock (Android fallback). */
export const HOME_DOCK_CLEARANCE = SEARCH_HEIGHT + 24;

/**
 * Android (and non–Liquid Glass) floating Search + compose dock.
 * On iOS, Mail home uses Stack.SearchBar + bottom Toolbar instead.
 */
export function HomeDock({
  searchActive,
  searchValue,
  onSearchChangeText,
  onSearchActivate,
  onSearchClose,
  onCompose,
}: {
  readonly searchActive: boolean;
  readonly searchValue: string;
  readonly onSearchChangeText: (text: string) => void;
  readonly onSearchActivate: () => void;
  readonly onSearchClose: () => void;
  readonly onCompose: () => void;
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
  const cardColor = useCSSVariable("--color-card") as string | undefined;

  const activeProgress = useSharedValue(searchActive ? 1 : 0);
  const keyboardHeight = useSharedValue(
    KeyboardController.isVisible() ? KeyboardController.state().height : 0,
  );
  const restingPad = Math.max(insets.bottom, 12) + 4;

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (!cancelled) setReducedTransparency(enabled);
    });
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceTransparencyChanged",
      setReducedTransparency,
    );
    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    activeProgress.value = withTiming(searchActive ? 1 : 0, {
      duration: MORPH_MS,
      easing: Easing.out(Easing.cubic),
    });
    if (searchActive) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      inputRef.current?.blur();
    }
  }, [searchActive, activeProgress]);

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

  const dockStyle = useAnimatedStyle(() => ({
    bottom: Math.max(keyboardHeight.value, restingPad),
  }));

  const composeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      activeProgress.value,
      [0, 0.4],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    width: interpolate(
      activeProgress.value,
      [0, 1],
      [COMPOSE_SIZE, 0],
      Extrapolation.CLAMP,
    ),
    marginLeft: interpolate(
      activeProgress.value,
      [0, 1],
      [GAP, 0],
      Extrapolation.CLAMP,
    ),
    overflow: "hidden" as const,
  }));

  const dismissStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      activeProgress.value,
      [0.4, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    width: interpolate(
      activeProgress.value,
      [0, 1],
      [0, COMPOSE_SIZE],
      Extrapolation.CLAMP,
    ),
    marginLeft: interpolate(
      activeProgress.value,
      [0, 1],
      [0, GAP],
      Extrapolation.CLAMP,
    ),
    overflow: "hidden" as const,
  }));

  const useGlass = CAN_USE_LIQUID_GLASS && !reducedTransparency;

  const Shell = ({
    children,
    round,
  }: {
    readonly children: ReactNode;
    readonly round: number;
  }) => (
    <View style={[styles.shell, { borderRadius: round, overflow: "hidden" }]}>
      {useGlass ? (
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          style={[StyleSheet.absoluteFill, { borderRadius: round }]}
        />
      ) : (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: round,
              backgroundColor: cardColor ?? "#FFFFFF",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: "rgba(0,0,0,0.08)",
            },
          ]}
        />
      )}
      {children}
    </View>
  );

  return (
    <Animated.View pointerEvents="box-none" style={[styles.dock, dockStyle]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Search chats"
          onPress={searchActive ? undefined : onSearchActivate}
          style={styles.searchFlex}
        >
          <Shell round={SEARCH_HEIGHT / 2}>
            <View style={styles.searchInner}>
              <Icon
                as={SearchIcon}
                size={20}
                color={placeholderColor ?? "#8E8E93"}
              />
              {searchActive ? (
                <TextInput
                  ref={inputRef}
                  value={searchValue}
                  onChangeText={onSearchChangeText}
                  placeholder="Search"
                  placeholderTextColor={placeholderColor ?? "#8E8E93"}
                  className={cn(textVariants({ variant: "label" }))}
                  style={[styles.input, { color: foregroundColor }]}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              ) : (
                <>
                  <View style={styles.placeholderGrow}>
                    <Text
                      variant="label"
                      style={{ color: placeholderColor ?? "#8E8E93" }}
                    >
                      Search
                    </Text>
                  </View>
                  <Icon
                    as={MicIcon}
                    size={20}
                    color={placeholderColor ?? "#8E8E93"}
                  />
                </>
              )}
            </View>
          </Shell>
        </Pressable>

        <Animated.View
          style={dismissStyle}
          pointerEvents={searchActive ? "auto" : "none"}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close search"
            onPress={onSearchClose}
          >
            <Shell round={COMPOSE_SIZE / 2}>
              <View style={styles.composeInner}>
                <Icon as={XIcon} size={22} color={foregroundColor ?? "#111"} />
              </View>
            </Shell>
          </Pressable>
        </Animated.View>

        <Animated.View
          style={composeStyle}
          pointerEvents={searchActive ? "none" : "auto"}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Compose"
            onPress={onCompose}
          >
            <Shell round={COMPOSE_SIZE / 2}>
              <View style={styles.composeInner}>
                <Icon
                  as={SquarePenIcon}
                  size={22}
                  color={foregroundColor ?? "#111"}
                />
              </View>
            </Shell>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: EDGE,
    zIndex: 50,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchFlex: {
    flex: 1,
  },
  shell: {
    height: SEARCH_HEIGHT,
  },
  searchInner: {
    flex: 1,
    height: SEARCH_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
  },
  placeholderGrow: { flex: 1 },
  input: {
    flex: 1,
    paddingVertical: 0,
  },
  composeInner: {
    width: COMPOSE_SIZE,
    height: COMPOSE_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
});
