import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Text } from "@/components/ui/text";

const EDGE = 16;

/** Space the chat list should leave so rows clear this docked card. */
export const SIGN_IN_CARD_CLEARANCE = 280;

/**
 * Replaces Ask Pearl once a guest already has a saved thread.
 * Same shape as a setup card: mark, title, short line, Continue.
 */
export function SignInForNewChatCard() {
  const insets = useSafeAreaInsets();
  const cardColor = useCSSVariable("--color-card") as string | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const borderColor = useCSSVariable("--color-border") as string | undefined;
  const restingPad = Math.max(insets.bottom, 12) + 4;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <View style={[styles.dock, { bottom: restingPad }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: cardColor ?? "#FFFFFF",
              borderColor: borderColor ?? "rgba(0,0,0,0.08)",
            },
          ]}
        >
          <View
            style={[
              styles.mark,
              { borderColor: foregroundColor ?? "#111" },
            ]}
          />
          <Text variant="label" weight="semibold" className="mt-3">
            Sign in to chat more
          </Text>
          <Text variant="body" tone="muted" className="mt-1">
            This conversation is saved. Sign in to start another.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue to sign in"
            onPress={() => router.push("/sign-in")}
            style={[
              styles.continue,
              { backgroundColor: foregroundColor ?? "#111" },
            ]}
          >
            <Text
              variant="label"
              weight="semibold"
              style={{ color: backgroundColor ?? "#FFFFFF" }}
            >
              Continue
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
  dock: {
    position: "absolute",
    left: EDGE,
    right: EDGE,
  },
  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3.5,
  },
  continue: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
