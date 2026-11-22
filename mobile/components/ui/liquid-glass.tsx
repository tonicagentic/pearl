import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { useCSSVariable } from "uniwind";

/** True when iOS liquid glass APIs are present (ignores Reduce Transparency). */
export function canUseLiquidGlass(): boolean {
  return (
    Platform.OS === "ios" &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable()
  );
}

/**
 * Absolute-fill glass surface with Reduce Transparency → solid card fallback.
 * Parent should clip (`overflow: "hidden"`) and set border radius.
 */
export function LiquidGlassSurface({
  style,
  interactive = false,
  fallbackColor,
}: {
  readonly style?: StyleProp<ViewStyle>;
  readonly interactive?: boolean;
  readonly fallbackColor?: string;
}) {
  const cardColor = useCSSVariable("--color-card") as string | undefined;
  const [reducedTransparency, setReducedTransparency] = useState(
    !canUseLiquidGlass(),
  );
  const showGlass = canUseLiquidGlass() && !reducedTransparency;

  useEffect(() => {
    if (!canUseLiquidGlass()) return;
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

  if (showGlass) {
    return (
      <GlassView
        pointerEvents="none"
        glassEffectStyle="regular"
        isInteractive={interactive}
        style={[StyleSheet.absoluteFill, style]}
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: fallbackColor ?? cardColor ?? "#FFFFFF",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: "rgba(0,0,0,0.08)",
        },
        style,
      ]}
    />
  );
}

/** Clipped shell that paints `LiquidGlassSurface` behind children. */
export function LiquidGlassShell({
  children,
  style,
  contentStyle,
  interactive = false,
  fallbackColor,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly interactive?: boolean;
  readonly fallbackColor?: string;
}) {
  return (
    <View style={[{ overflow: "hidden" }, style]}>
      <LiquidGlassSurface
        interactive={interactive}
        fallbackColor={fallbackColor}
      />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}
