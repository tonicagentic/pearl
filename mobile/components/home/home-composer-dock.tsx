import { useEffect, useState, type ComponentRef, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Text } from "@/components/ui/text";

const CAN_USE_LIQUID_GLASS =
  Platform.OS === "ios" &&
  isGlassEffectAPIAvailable() &&
  isLiquidGlassAvailable();

const EDGE = 16;
const COMPOSER_HEIGHT = 52;

/** List padding so rows clear the floating composer. */
export const HOME_COMPOSER_CLEARANCE = COMPOSER_HEIGHT + 24;

/**
 * Full-width Ask Pearl control on home. Tapping it opens a new chat.
 */
export function HomeComposerDock({
  onPress,
  dockRef,
}: {
  readonly onPress: () => void;
  /** Optional measure target for the walkthrough spotlight. */
  readonly dockRef?: React.RefObject<ComponentRef<typeof View> | null>;
}) {
  const insets = useSafeAreaInsets();
  const [reducedTransparency, setReducedTransparency] = useState(true);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const cardColor = useCSSVariable("--color-card") as string | undefined;

  const restingPad = Math.max(insets.bottom, 12) + 4;
  const useGlass = CAN_USE_LIQUID_GLASS && !reducedTransparency;

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

  const Shell = ({ children }: { readonly children: ReactNode }) => (
    <View
      style={[
        styles.shell,
        { borderRadius: COMPOSER_HEIGHT / 2, overflow: "hidden" },
      ]}
    >
      {useGlass ? (
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: COMPOSER_HEIGHT / 2 },
          ]}
        />
      ) : (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: COMPOSER_HEIGHT / 2,
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
    <View
      ref={dockRef}
      collapsable={false}
      pointerEvents="box-none"
      style={styles.dockHost}
    >
      <View pointerEvents="box-none" style={[styles.dock, { bottom: restingPad }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New chat"
          onPress={onPress}
          style={styles.composerFlex}
        >
          <Shell>
            <View style={styles.composerInner}>
              <Text
                variant="label"
                style={{ color: placeholderColor ?? "#8E8E93" }}
              >
                New chat
              </Text>
            </View>
          </Shell>
        </Pressable>
      </View>
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
  composerFlex: {
    flex: 1,
    minWidth: 0,
  },
  shell: {
    height: COMPOSER_HEIGHT,
  },
  composerInner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
});
