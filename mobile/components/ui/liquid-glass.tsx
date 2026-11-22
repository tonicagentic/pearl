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
import {
  usePearlCardBackground,
  usePearlHairlineBorder,
} from "@/src/navigation-theme";

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
  const cardColor = usePearlCardBackground();
  const hairline = usePearlHairlineBorder();
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

  const flat = StyleSheet.flatten(style) ?? {};
  // Native GlassView reads cornerConfiguration from the borderRadius *prop*
  // (style alone often leaves a rounded square).
  const radius =
    typeof flat.borderRadius === "number" ? flat.borderRadius : undefined;

  if (showGlass) {
    return (
      <GlassView
        pointerEvents="none"
        glassEffectStyle="regular"
        isInteractive={interactive}
        borderRadius={radius}
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
          backgroundColor: fallbackColor ?? cardColor,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: hairline,
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
  // GlassView ignores parent overflow clipping — radius must live on the
  // glass layer itself or it paints as a rounded square.
  const flat = StyleSheet.flatten(style) ?? {};
  const surfaceRadius = {
    borderRadius: flat.borderRadius,
    borderTopLeftRadius: flat.borderTopLeftRadius,
    borderTopRightRadius: flat.borderTopRightRadius,
    borderBottomLeftRadius: flat.borderBottomLeftRadius,
    borderBottomRightRadius: flat.borderBottomRightRadius,
  };

  return (
    <View style={[{ overflow: "hidden" }, style]}>
      <LiquidGlassSurface
        interactive={interactive}
        fallbackColor={fallbackColor}
        style={surfaceRadius}
      />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}
