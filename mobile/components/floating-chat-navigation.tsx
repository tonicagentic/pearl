import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActionSheetIOS, Keyboard, Platform, Pressable, StyleSheet, View, findNodeHandle } from "react-native";
import { router } from "expo-router";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { EllipsisIcon, SquarePenIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  onOpenHistory,
  onNewChat,
  disabled,
}: {
  title: string;
  onOpenHistory: () => void;
  onNewChat: () => void;
  disabled: boolean;
}) {
  const insets = useSafeAreaInsets();
  const moreButton = useRef<View>(null);
  const [reducedTransparency, setReducedTransparency] = useState(true);

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
        options: ["Areas", "Issues", "Cancel"],
        cancelButtonIndex: 2,
        anchor: findNodeHandle(moreButton.current) ?? undefined,
      },
      (index) => {
        if (index === 0) router.push("/areas");
        if (index === 1) router.push("/issues");
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
      <View style={styles.pill}>
        {surface()}
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
      </View>
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
  pill: { width: 112, height: 48, flexDirection: "row" },
  pillButton: { width: 56, height: 48, alignItems: "center", justifyContent: "center" },
});
