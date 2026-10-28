import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActionSheetIOS, Keyboard, Platform, Pressable, StyleSheet, View, findNodeHandle } from "react-native";
import { router } from "expo-router";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { EllipsisIcon, SquarePenIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const CAN_USE_LIQUID_GLASS = Platform.OS === "ios" && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
const surfaceStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  borderRadius: 28,
} as const;

/** Floating iOS controls; the thread and its gestures stay mounted beneath them. */
export function FloatingChatNavigation({
  title,
  hasMessages,
  onOpenHistory,
  onNewChat,
  disabled,
}: {
  title: string;
  hasMessages: boolean;
  onOpenHistory: () => void;
  onNewChat: () => void;
  disabled: boolean;
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
  const pillStyle = useAnimatedStyle(() => ({ width: 56 + 56 * reveal.value }));
  const newChatStyle = useAnimatedStyle(() => ({
    // Wait until the expanding glass reaches the icon before fading it in.
    opacity: interpolate(reveal.value, [0, 0.55, 1], [0, 0, 1]),
    transform: [{ translateX: 8 * (1 - reveal.value) }],
  }));
  const moreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [0, 0.35, 1], [0, 1, 1]),
  }));

  useEffect(() => {
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReducedTransparency,
    );
    void AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => { if (mounted) setReducedTransparency(enabled); })
      .catch(() => {});
    return () => { mounted = false; subscription.remove(); };
  }, []);

  const glass = CAN_USE_LIQUID_GLASS && !reducedTransparency;
  const surface = () => glass ? (
    <GlassView pointerEvents="none" glassEffectStyle="regular" style={surfaceStyle} />
  ) : (
    <View pointerEvents="none" className="absolute inset-0 rounded-full border border-border/60 bg-card" />
  );

  const openMore = () => {
    Keyboard.dismiss();
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: title === "New chat" ? undefined : title,
        options: ["Areas", "Issues", "Apps", "Cancel"],
        cancelButtonIndex: 3,
        anchor: findNodeHandle(moreButton.current) ?? undefined,
      },
      (index) => {
        if (index === 0) router.push("/areas");
        if (index === 1) router.push("/issues");
        if (index === 2) router.push("/apps");
      },
    );
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
          accessibilityLabel="Open history"
          accessibilityHint="Shows your chats and navigation"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onOpenHistory}
          style={styles.circleButton}
        >
          <View style={styles.historyBars}>
            <View className="h-[2.5px] w-6 rounded-full bg-foreground" />
            <View className="h-[2.5px] w-4 rounded-full bg-foreground" />
          </View>
        </Pressable>
      </View>
      {hasMessages ? (
        <Animated.View style={[styles.pill, pillStyle]}>
          {surface()}
          <Animated.View style={[styles.newChatAction, newChatStyle]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New chat"
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={onNewChat}
              style={styles.pillButton}
            >
              <SquarePenIcon className="size-6 text-foreground" />
            </Pressable>
          </Animated.View>
          <Animated.View style={[styles.moreAction, moreStyle]}>
            <Pressable
              ref={moreButton}
              accessibilityRole="button"
              accessibilityLabel="More navigation"
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={openMore}
              style={styles.pillButton}
            >
              <EllipsisIcon className="size-6 text-foreground" />
            </Pressable>
          </Animated.View>
        </Animated.View>
      ) : null}
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
  circleButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  historyBars: { gap: 7, alignItems: "flex-start" },
  pill: { height: 48 },
  pillButton: { width: 56, height: 48, alignItems: "center", justifyContent: "center" },
  newChatAction: { position: "absolute", right: 56, top: 0 },
  moreAction: { position: "absolute", right: 0, top: 0 },
});
