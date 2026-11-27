import type { ComponentType, ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import type { LucideProps } from "lucide-react-native";

import { Icon } from "@/components/ui/icon";
import {
  MATRIX_DOT_LOADER_SIZE,
  MatrixDotLoader,
} from "@/components/ui/matrix-dot-loader";
import {
  CHAT_PRESENCE_AMBER,
  CHAT_PRESENCE_BLUE,
  chatListPresence,
  chatPresenceAccessibilityLabel,
} from "@/src/chat-presence";
import type { ChatListItem } from "@/src/chats-client";
import { formatChatUpdatedAt } from "@/src/format-chat-updated-at";
import {
  usePearlDrawerSelectedBackground,
  usePearlForeground,
  usePearlPressWash,
} from "@/src/navigation-theme";
import { useCSSVariable } from "uniwind";

/** Outer list / nav stack inset — pairs with row horizontal pad. */
export const DRAWER_EDGE = 8;
/** Row content inset (icon + label). */
export const DRAWER_ROW_PAD_X = 12;
export const DRAWER_ROW_PAD_Y = 10;
export const DRAWER_ROW_MIN_HEIGHT = 44;
export const DRAWER_ROW_RADIUS = 12;
export const DRAWER_ICON_SLOT = 24;
export const DRAWER_ICON_GAP = 12;

type LucideIcon = ComponentType<LucideProps>;

/**
 * Destination / action row (New Chat, Tasks, …). Icon slot matches chat rows
 * so the column rhythm stays one vertical line.
 */
export function DrawerLinkRow({
  label,
  icon: RowIcon,
  onPress,
  selected = false,
}: {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly onPress: (event: GestureResponderEvent) => void;
  readonly selected?: boolean;
}) {
  const color = usePearlForeground();
  const pressWash = usePearlPressWash();
  const selectedBg = usePearlDrawerSelectedBackground();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected
            ? selectedBg
            : pressed
              ? pressWash
              : "transparent",
        },
      ]}
    >
      <View style={styles.iconSlot}>
        <Icon as={RowIcon} className="size-5 text-foreground" />
      </View>
      <Text
        style={[styles.linkLabel, { color }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** True when `pathname` is this drawer destination (or a nested screen under it). */
export function isDrawerHrefActive(
  pathname: string | null | undefined,
  href: string,
): boolean {
  if (!pathname) return false;
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/chat");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Recent-chat row for drawer chrome only (History page keeps its own rows). */
export function DrawerChatRow({
  chat,
  selected,
  mutedDot,
  onPress,
  onLongPress,
}: {
  readonly chat: ChatListItem;
  readonly selected: boolean;
  readonly mutedDot: string;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
}) {
  const presence = chatListPresence(chat);
  const when = formatChatUpdatedAt(chat.updatedAt);
  const selectedBg = usePearlDrawerSelectedBackground();
  const pressWash = usePearlPressWash();
  const foreground = usePearlForeground();
  const mutedForeground =
    (useCSSVariable("--color-muted-foreground") as string | undefined) ??
    "#8E8E93";
  const markColor =
    presence === "waiting"
      ? CHAT_PRESENCE_AMBER
      : presence === "unread"
        ? CHAT_PRESENCE_BLUE
        : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={chatPresenceAccessibilityLabel(chat.title, presence)}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected
            ? selectedBg
            : pressed
              ? pressWash
              : "transparent",
        },
      ]}
    >
      <View style={styles.iconSlot}>
        {presence === "working" ? (
          <View style={styles.presenceInner}>
            <MatrixDotLoader baseColor={mutedDot} />
          </View>
        ) : markColor ? (
          <View
            style={[styles.presenceDot, { backgroundColor: markColor }]}
          />
        ) : null}
      </View>
      <Text
        style={[styles.chatTitle, { color: foreground }]}
        numberOfLines={1}
      >
        {chat.title}
      </Text>
      {when ? (
        <Text
          style={[styles.chatMeta, { color: mutedForeground }]}
          numberOfLines={1}
        >
          {when}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function DrawerSectionLabel({
  children,
  actionLabel,
  actionAccessibilityLabel,
  onActionPress,
}: {
  readonly children: ReactNode;
  readonly actionLabel?: string;
  readonly actionAccessibilityLabel?: string;
  readonly onActionPress?: () => void;
}) {
  const mutedForeground =
    (useCSSVariable("--color-muted-foreground") as string | undefined) ??
    "#8E8E93";
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={[styles.sectionLabel, { color: mutedForeground, flex: 1 }]}>
        {children}
      </Text>
      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          hitSlop={8}
          onPress={onActionPress}
          style={styles.sectionAction}
        >
          <Text style={[styles.sectionActionLabel, { color: mutedForeground }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: DRAWER_ROW_MIN_HEIGHT,
    paddingHorizontal: DRAWER_ROW_PAD_X,
    paddingVertical: DRAWER_ROW_PAD_Y,
    borderRadius: DRAWER_ROW_RADIUS,
    flexDirection: "row",
    alignItems: "center",
    gap: DRAWER_ICON_GAP,
  },
  iconSlot: {
    width: DRAWER_ICON_SLOT,
    height: DRAWER_ICON_SLOT,
    alignItems: "center",
    justifyContent: "center",
  },
  presenceInner: {
    width: MATRIX_DOT_LOADER_SIZE,
    height: MATRIX_DOT_LOADER_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  linkLabel: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: "500",
  },
  chatTitle: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: "400",
  },
  chatMeta: {
    flexShrink: 0,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
    paddingRight: DRAWER_ROW_PAD_X,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: DRAWER_ROW_PAD_X,
  },
  sectionAction: {
    minHeight: 28,
    minWidth: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  sectionActionLabel: {
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 22,
  },
});
