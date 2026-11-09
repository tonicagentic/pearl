import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import {
  EllipsisIcon,
  HouseIcon,
  Settings2Icon,
  SquarePenIcon,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";

const CAN_USE_LIQUID_GLASS =
  Platform.OS === "ios" &&
  isGlassEffectAPIAvailable() &&
  isLiquidGlassAvailable();
const surfaceStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  borderRadius: 28,
} as const;

/**
 * Floating iOS controls that morph with history openProgress:
 * chat: Home left, New chat + ⋯ right; history: Settings left, New chat right.
 */
export function FloatingChatNavigation({
  openProgress,
  hasMessages,
  onOpenHistory,
  onOpenSettings,
  onNewChat,
  onOpenThreadActions,
  historyOpen,
}: {
  openProgress: SharedValue<number>;
  hasMessages: boolean;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onNewChat: () => void;
  onOpenThreadActions: () => void;
  /** Settled history-open flag for hit-testing roles (JS thread). */
  historyOpen: boolean;
}) {
  const insets = useSafeAreaInsets();
  const moreButton = useRef<View>(null);
  const [reducedTransparency, setReducedTransparency] = useState(true);
  const reveal = useSharedValue(hasMessages ? 1 : 0);
  useEffect(() => {
    reveal.value = withTiming(hasMessages ? 1 : 0, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [hasMessages, reveal]);

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

  const glass = CAN_USE_LIQUID_GLASS && !reducedTransparency;
  const surface = () =>
    glass ? (
      <GlassView
        pointerEvents="none"
        glassEffectStyle="regular"
        style={surfaceStyle}
      />
    ) : (
      <View
        pointerEvents="none"
        className="absolute inset-0 rounded-full border border-border/60 bg-card"
      />
    );

  // Left host: Home ↔ Settings on the same glass circle.
  const homeIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 0.45, 1], [1, 0.2, 0]),
    transform: [
      { scale: interpolate(openProgress.value, [0, 1], [1, 0.85]) },
    ],
  }));
  const settingsIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 0.55, 1], [0, 0.2, 1]),
    transform: [
      { scale: interpolate(openProgress.value, [0, 1], [0.85, 1]) },
    ],
  }));

  // Right host: chat pill (new + more) ↔ history new-chat circle.
  const chatPillStyle = useAnimatedStyle(() => {
    const history = openProgress.value;
    const msg = reveal.value;
    // Collapse width toward a single circle as history opens; expand with messages on chat.
    const chatWidth = 56 + 56 * msg;
    return {
      width: interpolate(history, [0, 1], [chatWidth, 48]),
      opacity: interpolate(history, [0, 0.35, 1], [1, 1, 1]),
    };
  });
  const chatNewStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      openProgress.value,
      [0, 0.4],
      [
        interpolate(reveal.value, [0, 0.55, 1], [0, 0, 1]),
        0,
      ],
      "clamp",
    ),
    transform: [{ translateX: 8 * (1 - reveal.value) }],
  }));
  const chatMoreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      openProgress.value,
      [0, 0.35],
      [interpolate(reveal.value, [0, 0.35, 1], [0, 1, 1]), 0],
      "clamp",
    ),
  }));
  const historyNewStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0.45, 0.75, 1], [0, 0.4, 1]),
    transform: [
      { scale: interpolate(openProgress.value, [0.45, 1], [0.85, 1]) },
    ],
  }));
  // Keep a hit target on the right when history is open even with no messages.
  const rightVisibleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      openProgress.value,
      [0, 0.01],
      [reveal.value > 0.01 ? 1 : 0, 1],
      "clamp",
    ),
  }));

  const onLeftPress = () => {
    Keyboard.dismiss();
    if (historyOpen) onOpenSettings();
    else onOpenHistory();
  };

  const onRightNewChat = () => {
    Keyboard.dismiss();
    onNewChat();
  };

  const onRightMore = () => {
    Keyboard.dismiss();
    onOpenThreadActions();
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.row, { top: insets.top + 10 }]}
    >
      <View style={styles.circle}>
        {surface()}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={historyOpen ? "Settings" : "Home"}
          accessibilityHint={
            historyOpen
              ? "Opens settings"
              : "Shows your chats and navigation"
          }
          onPress={onLeftPress}
          style={styles.circleButton}
        >
          <Animated.View style={[styles.iconLayer, homeIconStyle]}>
            <Icon as={HouseIcon} className="size-6 text-foreground" />
          </Animated.View>
          <Animated.View style={[styles.iconLayer, settingsIconStyle]}>
            <Icon as={Settings2Icon} className="size-6 text-foreground" />
          </Animated.View>
        </Pressable>
      </View>

      <Animated.View
        style={[styles.pill, chatPillStyle, rightVisibleStyle]}
        pointerEvents={hasMessages || historyOpen ? "box-none" : "none"}
      >
        {surface()}
        {/* Chat-mode new chat (pill left segment) */}
        <Animated.View
          style={[styles.newChatAction, chatNewStyle]}
          pointerEvents={historyOpen || !hasMessages ? "none" : "auto"}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New chat"
            onPress={onRightNewChat}
            style={styles.pillButton}
          >
            <Icon as={SquarePenIcon} className="size-6 text-foreground" />
          </Pressable>
        </Animated.View>
        {/* Chat-mode more */}
        <Animated.View
          style={[styles.moreAction, chatMoreStyle]}
          pointerEvents={historyOpen || !hasMessages ? "none" : "auto"}
        >
          <Pressable
            ref={moreButton}
            accessibilityRole="button"
            accessibilityLabel="Thread actions"
            onPress={onRightMore}
            style={styles.pillButton}
          >
            <Icon as={EllipsisIcon} className="size-6 text-foreground" />
          </Pressable>
        </Animated.View>
        {/* History-mode new chat (fills the host) */}
        <Animated.View
          style={[styles.historyNewAction, historyNewStyle]}
          pointerEvents={historyOpen ? "auto" : "none"}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New chat"
            onPress={onRightNewChat}
            style={styles.circleButton}
          >
            <Icon as={SquarePenIcon} className="size-6 text-foreground" />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  circle: { width: 48, height: 48 },
  circleButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  iconLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: { height: 48, overflow: "hidden" },
  pillButton: {
    width: 56,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  newChatAction: { position: "absolute", right: 56, top: 0 },
  moreAction: { position: "absolute", right: 0, top: 0 },
  historyNewAction: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 48,
    height: 48,
  },
});
