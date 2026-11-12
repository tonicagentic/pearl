import { Image, StyleSheet, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import type {
  PearlIntroBubble,
  PearlIntroPanelId,
} from "@/components/pearl-intro-panels";
import { PEARL_INTRO_PANELS } from "@/components/pearl-intro-panels";

const icon = require("../assets/icon.png");

/** Decorative chat-bubble collage for one intro panel. */
export function PearlIntroGraphic({
  panelId,
}: {
  readonly panelId: PearlIntroPanelId;
}) {
  const panel = PEARL_INTRO_PANELS.find((entry) => entry.id === panelId);
  const cardColor = useCSSVariable("--color-card") as string | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const mutedColor = useCSSVariable("--color-muted") as string | undefined;
  const mutedForeground = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const primaryColor = useCSSVariable("--color-primary") as string | undefined;
  const primaryForeground = useCSSVariable("--color-primary-foreground") as
    | string
    | undefined;
  const borderColor = useCSSVariable("--color-border") as string | undefined;

  if (!panel) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      {panel.bubbles.map((bubble) => (
        <Bubble
          key={`${panelId}-${bubble.text}`}
          bubble={bubble}
          cardColor={cardColor}
          foregroundColor={foregroundColor}
          mutedColor={mutedColor}
          mutedForeground={mutedForeground}
          primaryColor={primaryColor}
          primaryForeground={primaryForeground}
          borderColor={borderColor}
        />
      ))}
      <View
        style={[
          styles.avatarRing,
          {
            backgroundColor: cardColor,
            borderColor: borderColor ?? "transparent",
          },
        ]}
      >
        <Image source={icon} style={styles.avatar} accessibilityIgnoresInvertColors />
      </View>
    </View>
  );
}

function Bubble({
  bubble,
  cardColor,
  foregroundColor,
  mutedColor,
  mutedForeground,
  primaryColor,
  primaryForeground,
  borderColor,
}: {
  readonly bubble: PearlIntroBubble;
  readonly cardColor: string | undefined;
  readonly foregroundColor: string | undefined;
  readonly mutedColor: string | undefined;
  readonly mutedForeground: string | undefined;
  readonly primaryColor: string | undefined;
  readonly primaryForeground: string | undefined;
  readonly borderColor: string | undefined;
}) {
  const palette =
    bubble.kind === "user"
      ? {
          backgroundColor: primaryColor,
          color: primaryForeground,
          borderColor: "transparent",
        }
      : bubble.kind === "status"
        ? {
            backgroundColor: mutedColor,
            color: mutedForeground,
            borderColor: borderColor,
          }
        : {
            backgroundColor: cardColor,
            color: foregroundColor,
            borderColor: borderColor,
          };

  return (
    <View
      style={[
        styles.bubble,
        {
          top: `${bubble.top}%`,
          left: `${bubble.left}%`,
          transform: [{ rotate: `${bubble.rotate}deg` }],
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor ?? "transparent",
        },
      ]}
    >
      <Text
        numberOfLines={2}
        style={[styles.bubbleText, { color: palette.color }]}
      >
        {bubble.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 2,
  },
  avatar: {
    width: 72,
    height: 72,
  },
  bubble: {
    position: "absolute",
    maxWidth: "46%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 1,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "500",
  },
});
