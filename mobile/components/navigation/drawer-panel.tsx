import { useCallback, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import { router } from "expo-router";
import {
  FolderIcon,
  InboxIcon,
  LibraryIcon,
  SearchIcon,
  SquarePenIcon,
  UserIcon,
  XIcon,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { ChatHistoryContent } from "@/components/history/chat-history-content";
import { Icon } from "@/components/ui/icon";
import { usePearlDrawer } from "@/components/navigation/drawer-context";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import { initials as viewerInitials } from "@/src/initials";
import {
  usePearlDrawerBackground,
  usePearlForeground,
  usePearlMutedBackground,
  usePearlPressWash,
} from "@/src/navigation-theme";

const CHAT_PILL_BLUE = "#007AFF";
/** Space reserved under the list so rows can scroll clear of the sticky footer. */
const FOOTER_CLEARANCE = 72;
const FOOTER_FADE_HEIGHT = 56;

const NAV_ROWS = [
  {
    label: "Tasks",
    href: "/tasks",
    Icon: InboxIcon,
  },
  {
    label: "Library",
    href: "/library",
    Icon: LibraryIcon,
  },
  {
    label: "Projects",
    href: "/workspaces",
    Icon: FolderIcon,
  },
] as const;

type DrawerPanelNav = {
  closeDrawer?: () => void;
};

/**
 * ChatGPT-style drawer body: one scrolling column (brand → nav → recent chats),
 * sticky Chat + profile with a soft fade so list content dissolves behind them.
 */
export function DrawerPanel({
  navigation,
}: {
  readonly navigation?: DrawerPanelNav;
} = {}) {
  const insets = useSafeAreaInsets();
  const { closeDrawer: closePearlDrawer, onSelectChatFromDrawer } =
    usePearlDrawer();
  const closeDrawer = useCallback(() => {
    if (navigation?.closeDrawer) {
      navigation.closeDrawer();
      return;
    }
    closePearlDrawer();
  }, [navigation, closePearlDrawer]);
  const openChatFromDrawer = useCallback(
    async (chatId: string) => {
      // Close immediately via drawerContent navigation (hook close can miss
      // here), then select + route.
      closeDrawer();
      await onSelectChatFromDrawer(chatId);
    },
    [closeDrawer, onSelectChatFromDrawer],
  );
  const { isAnonymous, viewerEmail, viewerName } = useAuth();
  const { newChat } = useChats();
  const foregroundColor = usePearlForeground();
  const mutedForeground = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const mutedColor = usePearlMutedBackground();
  const drawerBackground = usePearlDrawerBackground();
  const pressWash = usePearlPressWash();
  const [drawerSearchOpen, setDrawerSearchOpen] = useState(false);
  const profileInitials = isAnonymous
    ? null
    : viewerInitials(viewerName, viewerEmail);
  const bottomPad = Math.max(insets.bottom, 12);
  const listBottomInset = FOOTER_CLEARANCE + bottomPad;

  const go = useCallback(
    (href: string, options?: { readonly withAnchor?: boolean }) => {
      closeDrawer();
      requestAnimationFrame(() => {
        if (options?.withAnchor) {
          router.push(href as never, { withAnchor: true });
          return;
        }
        router.navigate(href as never);
      });
    },
    [closeDrawer],
  );

  const openNewChat = useCallback(() => {
    closeDrawer();
    if (isAnonymous) {
      requestAnimationFrame(() => {
        router.push("/sign-in");
      });
      return;
    }
    newChat();
    requestAnimationFrame(() => {
      router.navigate("/");
    });
  }, [closeDrawer, isAnonymous, newChat]);

  const openProfile = useCallback(() => {
    closeDrawer();
    requestAnimationFrame(() => {
      router.navigate(isAnonymous ? "/sign-in" : "/settings");
    });
  }, [closeDrawer, isAnonymous]);

  const openSeeAll = useCallback(() => {
    go("/history");
  }, [go]);

  const scrollingHeader = (
    <View>
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top, 8) + 4,
          paddingBottom: 4,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 40,
          }}
        >
          <Text
            style={{
              color: foregroundColor,
              fontSize: 28,
              fontWeight: "700",
              letterSpacing: -0.4,
            }}
          >
            Pearl
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              drawerSearchOpen ? "Close search" : "Search history"
            }
            hitSlop={8}
            onPress={() => setDrawerSearchOpen((v) => !v)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: mutedColor,
            }}
          >
            <Icon
              as={drawerSearchOpen ? XIcon : SearchIcon}
              className="size-4 text-foreground"
            />
          </Pressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: 8, paddingBottom: 8, gap: 2 }}>
        {NAV_ROWS.map((row) => (
          <DrawerNavRow
            key={row.href}
            label={row.label}
            icon={row.Icon}
            onPress={() => go(row.href)}
            color={foregroundColor}
            pressWash={pressWash}
          />
        ))}
        <Text
          style={{
            color: mutedForeground ?? "#8E8E93",
            fontSize: 13,
            fontWeight: "600",
            paddingHorizontal: 12,
            paddingTop: 14,
            paddingBottom: 6,
          }}
        >
          Recent chats
        </Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: drawerBackground }}>
      <View style={{ flex: 1 }}>
        <ChatHistoryContent
          chrome="drawer"
          showInlineSearch={drawerSearchOpen}
          onOpenChat={openChatFromDrawer}
          onSeeAll={openSeeAll}
          drawerHeader={scrollingHeader}
          contentBottomInset={listBottomInset}
        />
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.footerDock,
          {
            paddingBottom: bottomPad,
            backgroundColor: drawerBackground,
          },
        ]}
      >
        <View pointerEvents="none" style={styles.footerFade}>
          <Svg width="100%" height={FOOTER_FADE_HEIGHT} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient
                id="drawerFooterFade"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <Stop offset="0" stopColor={drawerBackground} stopOpacity="0" />
                <Stop
                  offset="0.55"
                  stopColor={drawerBackground}
                  stopOpacity="0.7"
                />
                <Stop offset="1" stopColor={drawerBackground} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect
              width="100%"
              height={FOOTER_FADE_HEIGHT}
              fill="url(#drawerFooterFade)"
            />
          </Svg>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingTop: 10,
            gap: 12,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New chat"
            onPress={openNewChat}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 18,
              height: 48,
              borderRadius: 24,
              backgroundColor: CHAT_PILL_BLUE,
            }}
          >
            <Icon as={SquarePenIcon} className="size-5 text-white" />
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 17,
                fontWeight: "600",
              }}
            >
              Chat
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isAnonymous ? "Sign in" : "Profile"}
            onPress={openProfile}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isAnonymous ? mutedColor : "#2A9D8F",
            }}
          >
            {isAnonymous ? (
              <Icon as={UserIcon} className="size-5 text-foreground" />
            ) : (
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                {profileInitials ?? "·"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** @deprecated Prefer DrawerPanel */
export const HistoryDrawerPanel = DrawerPanel;

function DrawerNavRow({
  label,
  icon: RowIcon,
  onPress,
  color,
  pressWash,
}: {
  readonly label: string;
  readonly icon: typeof InboxIcon;
  readonly onPress: (event: GestureResponderEvent) => void;
  readonly color?: string;
  readonly pressWash: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: pressed ? pressWash : "transparent",
      })}
    >
      <Icon as={RowIcon} className="size-5 text-foreground" />
      <Text
        style={{
          color: color,
          fontSize: 17,
          fontWeight: "500",
          flexShrink: 1,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footerDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  footerFade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -FOOTER_FADE_HEIGHT,
    height: FOOTER_FADE_HEIGHT,
  },
});
