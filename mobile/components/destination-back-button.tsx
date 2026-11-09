import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { ChevronLeftIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";

const CAN_USE_LIQUID_GLASS =
  Platform.OS === "ios" &&
  isGlassEffectAPIAvailable() &&
  isLiquidGlassAvailable();

/** Floating glass back control for stack destinations (Projects, Tasks, …). */
export function DestinationBackButton({
  onPress,
  accessibilityLabel = "Back",
}: {
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
} = {}) {
  const insets = useSafeAreaInsets();
  const [reducedTransparency, setReducedTransparency] = useState(true);

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

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: insets.top + 10 }]}
    >
      <View style={styles.circle}>
        {glass ? (
          <GlassView
            pointerEvents="none"
            glassEffectStyle="regular"
            style={styles.surface}
          />
        ) : (
          <View
            pointerEvents="none"
            className="absolute inset-0 rounded-full border border-border/60 bg-card"
          />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={() => {
            if (onPress) onPress();
            else if (router.canGoBack()) router.back();
            else router.replace("/");
          }}
          style={styles.button}
        >
          <Icon as={ChevronLeftIcon} className="size-6 text-foreground" />
        </Pressable>
      </View>
    </View>
  );
}

/** Top inset so destination content clears the floating back button. */
export const DESTINATION_TOP_CLEARANCE = 80;

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 16,
    zIndex: 20,
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 28,
    overflow: "hidden",
  },
  surface: {
    ...StyleSheet.absoluteFill,
    borderRadius: 28,
  },
  button: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
