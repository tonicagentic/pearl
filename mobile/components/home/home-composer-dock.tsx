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

import { SquarePenIcon } from "lucide-react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
  usePearlCardBackground,
  usePearlHairlineBorder,
} from "@/src/navigation-theme";

const CAN_USE_LIQUID_GLASS =
  Platform.OS === "ios" &&
  isGlassEffectAPIAvailable() &&
  isLiquidGlassAvailable();

const EDGE = 16;
const COMPOSER_HEIGHT = 52;
const FAB_SIZE = 56;

/** List padding so rows clear the floating composer. */
export const HOME_COMPOSER_CLEARANCE = COMPOSER_HEIGHT + 24;

/** List padding so rows clear the bottom-right compose FAB. */
export const HOME_COMPOSE_FAB_CLEARANCE = FAB_SIZE + 28;

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
  const [reducedTransparency, setReducedTransparency] = useState(
    !CAN_USE_LIQUID_GLASS,
  );
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const cardColor = usePearlCardBackground();
  const hairline = usePearlHairlineBorder();

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
              backgroundColor: cardColor,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: hairline,
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

/**
 * Bottom-right compose control on home. Tapping it opens a new chat.
 */
export function HomeComposeFab({ onPress }: { readonly onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const primaryColor = useCSSVariable("--color-primary") as string | undefined;
  const primaryForeground = useCSSVariable("--color-primary-foreground") as
    | string
    | undefined;
  const restingPad = Math.max(insets.bottom, 12) + 4;

  return (
    <View pointerEvents="box-none" style={styles.fabHost}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New chat"
        onPress={onPress}
        style={[styles.fab, { bottom: restingPad, right: EDGE }]}
      >
        <View
          style={[
            styles.fabShell,
            {
              borderRadius: FAB_SIZE / 2,
              backgroundColor: primaryColor ?? "#111111",
            },
          ]}
        >
          <View style={styles.fabInner}>
            <Icon
              as={SquarePenIcon}
              size={22}
              color={primaryForeground ?? "#FFFFFF"}
            />
          </View>
        </View>
      </Pressable>
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
  fabHost: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
  fab: {
    position: "absolute",
  },
  fabShell: {
    width: FAB_SIZE,
    height: FAB_SIZE,
  },
  fabInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
