import { useCallback, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, usePathname } from "expo-router";
import {
  FolderIcon,
  InboxIcon,
  LibraryIcon,
  NotebookPenIcon,
  SearchIcon,
  SquarePenIcon,
  TargetIcon,
  UserIcon,
  WalletIcon,
  XIcon,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { ChatHistoryContent } from "@/components/history/chat-history-content";
import { usePearlDrawer } from "@/components/navigation/drawer-context";
import {
  DRAWER_EDGE,
  DRAWER_ROW_PAD_X,
  DrawerLinkRow,
  DrawerSectionLabel,
  isDrawerHrefActive,
} from "@/components/navigation/drawer-rows";
import { PearlIcon } from "@/components/pearl-icon";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import { initials as viewerInitials } from "@/src/initials";
import {
  usePearlDrawerBackground,
  usePearlForeground,
  usePearlMutedBackground,
} from "@/src/navigation-theme";

/** Space reserved under the list so rows can clear the floating search. */
const FOOTER_CLEARANCE = 56;
/** Soft dissolve above the search control before the fade reaches the display edge. */
const FOOTER_FADE_OVERHANG = 56;
/** Search row inside the dock (paddingTop 8 + 40px control). */
const FOOTER_SEARCH_ROW = 48;

const NAV_ROWS = [
  {
    label: "Tasks",
    href: "/tasks",
    Icon: InboxIcon,
  },
  {
    label: "Goals",
    href: "/goals",
    Icon: TargetIcon,
  },
  {
    label: "Notes",
    href: "/notes",
    Icon: NotebookPenIcon,
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
  {
    label: "Finances",
    href: "/finances",
    Icon: WalletIcon,
  },
] as const;

type DrawerPanelNav = {
  closeDrawer?: () => void;
};

/**
 * ChatGPT-style drawer body: one scrolling column (brand → nav → recent chats),
 * sticky search with a soft fade so list content dissolves behind it.
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
  const { newChat, activeChatId } = useChats();
  const pathname = usePathname();
  const onChatRoute = isDrawerHrefActive(pathname, "/");
  // New Chat lights only on an empty home/chat session — not while a thread
  // is open, and not on Tasks/Goals/… destinations.
  const newChatSelected = onChatRoute && activeChatId == null;
  const foregroundColor = usePearlForeground();
  const mutedColor = usePearlMutedBackground();
  const drawerBackground = usePearlDrawerBackground();
  const [drawerSearchOpen, setDrawerSearchOpen] = useState(false);
  const profileInitials = isAnonymous
    ? null
    : viewerInitials(viewerName, viewerEmail);
  const bottomPad = Math.max(insets.bottom, 12);
  const listBottomInset = FOOTER_CLEARANCE + bottomPad;
  // Fade spans the overhang + search row + home-indicator pad so threads
  // dissolve into the display edge instead of a solid footer band.
  const footerFadeHeight =
    FOOTER_FADE_OVERHANG + FOOTER_SEARCH_ROW + bottomPad;

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
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel="Pearl"
            style={{ justifyContent: "center", minHeight: 32 }}
          >
            <PearlIcon size={28} color={foregroundColor} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isAnonymous ? "Sign in" : "Profile"}
            hitSlop={8}
            onPress={openProfile}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isAnonymous ? mutedColor : "#2A9D8F",
            }}
          >
            {isAnonymous ? (
              <Icon as={UserIcon} className="size-4 text-foreground" />
            ) : (
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {profileInitials ?? "·"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: DRAWER_EDGE,
          paddingBottom: 4,
          gap: 1,
        }}
      >
        <DrawerLinkRow
          label="New Chat"
          icon={SquarePenIcon}
          onPress={openNewChat}
          selected={newChatSelected}
        />
        {NAV_ROWS.map((row) => (
          <DrawerLinkRow
            key={row.href}
            label={row.label}
            icon={row.Icon}
            onPress={() => go(row.href)}
            selected={isDrawerHrefActive(pathname, row.href)}
          />
        ))}
        <DrawerSectionLabel>Recent chats</DrawerSectionLabel>
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
        style={[styles.footerDock, { paddingBottom: bottomPad }]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.footerFade,
            {
              top: -FOOTER_FADE_OVERHANG,
              height: footerFadeHeight,
            },
          ]}
        >
          <Svg
            width="100%"
            height={footerFadeHeight}
            style={StyleSheet.absoluteFill}
          >
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
                  offset="0.4"
                  stopColor={drawerBackground}
                  stopOpacity="0.55"
                />
                <Stop
                  offset="0.75"
                  stopColor={drawerBackground}
                  stopOpacity="0.9"
                />
                <Stop offset="1" stopColor={drawerBackground} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect
              width="100%"
              height={footerFadeHeight}
              fill="url(#drawerFooterFade)"
            />
          </Svg>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: DRAWER_EDGE + DRAWER_ROW_PAD_X,
            paddingTop: 8,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              drawerSearchOpen ? "Close search" : "Search history"
            }
            hitSlop={8}
            onPress={() => setDrawerSearchOpen((v) => !v)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: mutedColor,
            }}
          >
            <Icon
              as={drawerSearchOpen ? XIcon : SearchIcon}
              className="size-5 text-foreground"
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** @deprecated Prefer DrawerPanel */
export const HistoryDrawerPanel = DrawerPanel;

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
  },
});
