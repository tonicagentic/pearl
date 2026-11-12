import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
} from "react-native";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { SearchIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";

const CAN_USE_LIQUID_GLASS =
  Platform.OS === "ios" &&
  isGlassEffectAPIAvailable() &&
  isLiquidGlassAvailable();

/** Match the floating iOS composer dock. */
const COMPOSER_EDGE = 16;
const COMPOSER_SHELL_RADIUS = 26;
const SEARCH_SHELL_HEIGHT = 52;

/** Bottom glass search field for the /history route. */
export function HistorySearchBar({
  value,
  onChangeText,
}: {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
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
      style={[
        styles.dock,
        {
          paddingBottom: Math.max(insets.bottom, 12) + 4,
          paddingHorizontal: COMPOSER_EDGE,
        },
      ]}
    >
      <View style={styles.shell}>
        {glass ? (
          <GlassView
            pointerEvents="none"
            glassEffectStyle="regular"
            style={styles.surface}
          />
        ) : (
          <View
            pointerEvents="none"
            className="border-border/60 bg-card absolute inset-0 border"
            style={{ borderRadius: COMPOSER_SHELL_RADIUS }}
          />
        )}
        <View style={styles.row}>
          <Icon as={SearchIcon} className="size-5 text-muted-foreground" />
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            placeholder="Search chats"
            placeholderTextColor={placeholderColor}
            accessibilityLabel="Search chats"
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoCapitalize="none"
            style={[styles.input, { color: foregroundColor }]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  shell: {
    height: SEARCH_SHELL_HEIGHT,
    borderRadius: COMPOSER_SHELL_RADIUS,
    overflow: "hidden",
    justifyContent: "center",
  },
  surface: {
    ...StyleSheet.absoluteFill,
    borderRadius: COMPOSER_SHELL_RADIUS,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    height: SEARCH_SHELL_HEIGHT,
  },
  input: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    paddingVertical: 0,
  },
});
