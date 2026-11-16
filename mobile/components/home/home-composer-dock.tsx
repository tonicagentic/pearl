import {
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from "react";
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
import { ArrowUpIcon, XIcon } from "lucide-react-native";
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
const COMPOSER_HEIGHT = 52;
const GAP = 10;
const MORPH_MS = 280;

/** List padding so rows clear the floating composer. */
export const HOME_COMPOSER_CLEARANCE = COMPOSER_HEIGHT + 24;

/**
 * Full-width Ask Pearl composer for home. Focus expands like search (field
 * stays docked; overlay above is owned by the parent). Send settles the
 * thread via `onSend`.
 */
export function HomeComposerDock({
  active,
  value,
  onChangeText,
  onActivate,
  onClose,
  onSend,
  dockRef,
}: {
  readonly active: boolean;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly onActivate: () => void;
  readonly onClose: () => void;
  readonly onSend: (text: string) => void;
  /** Optional measure target for the walkthrough spotlight. */
  readonly dockRef?: React.RefObject<ComponentRef<typeof View> | null>;
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
  const primaryColor = useCSSVariable("--color-primary") as string | undefined;
  const primaryFg = useCSSVariable("--color-primary-foreground") as
    | string
    | undefined;

  const activeProgress = useSharedValue(active ? 1 : 0);
  const keyboardHeight = useSharedValue(
    KeyboardController.isVisible() ? KeyboardController.state().height : 0,
  );
  const restingPad = Math.max(insets.bottom, 12) + 4;
  const canSend = value.trim().length > 0;

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
    activeProgress.value = withTiming(active ? 1 : 0, {
      duration: MORPH_MS,
      easing: Easing.out(Easing.cubic),
    });
    if (active) {
      requestAnimationFrame(() => inputRef.current?.focus());
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

  const dockStyle = useAnimatedStyle(() => ({
    bottom: Math.max(keyboardHeight.value, restingPad),
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
      [0, COMPOSER_HEIGHT],
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

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
  };

  return (
    <View ref={dockRef} collapsable={false} pointerEvents="box-none" style={styles.dockHost}>
    <Animated.View
      pointerEvents="box-none"
      style={[styles.dock, dockStyle]}
    >
      <View style={styles.row}>
        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Ask Pearl"
          onPress={active ? undefined : onActivate}
          style={styles.composerFlex}
        >
          <Shell round={COMPOSER_HEIGHT / 2}>
            <View style={styles.composerInner}>
              {active ? (
                <TextInput
                  ref={inputRef}
                  value={value}
                  onChangeText={onChangeText}
                  placeholder="Ask Pearl"
                  placeholderTextColor={placeholderColor ?? "#8E8E93"}
                  className={cn(textVariants({ variant: "label" }))}
                  style={[styles.input, { color: foregroundColor }]}
                  returnKeyType="send"
                  blurOnSubmit={false}
                  onSubmitEditing={submit}
                  autoCorrect
                  autoCapitalize="sentences"
                />
              ) : (
                <View style={styles.placeholderGrow}>
                  <Text
                    variant="label"
                    style={{ color: placeholderColor ?? "#8E8E93" }}
                  >
                    Ask Pearl
                  </Text>
                </View>
              )}
              {active && canSend ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send"
                  onPress={submit}
                  hitSlop={8}
                  style={[
                    styles.send,
                    { backgroundColor: primaryColor ?? "#111" },
                  ]}
                >
                  <Icon
                    as={ArrowUpIcon}
                    size={18}
                    color={primaryFg ?? "#FFFFFF"}
                  />
                </Pressable>
              ) : null}
            </View>
          </Shell>
        </Pressable>

        <Animated.View
          style={dismissStyle}
          pointerEvents={active ? "auto" : "none"}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onClose}
          >
            <Shell round={COMPOSER_HEIGHT / 2}>
              <View style={styles.dismissInner}>
                <Icon as={XIcon} size={22} color={foregroundColor ?? "#111"} />
              </View>
            </Shell>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockHost: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
  dock: {
    position: "absolute",
    left: EDGE,
    right: EDGE,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  composerFlex: {
    flex: 1,
    minWidth: 0,
  },
  shell: {
    height: COMPOSER_HEIGHT,
  },
  composerInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
  },
  placeholderGrow: {
    flex: 1,
    justifyContent: "center",
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    margin: 0,
  },
  send: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
