import { useCallback, useEffect, useState } from "react";
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
import { useCSSVariable } from "uniwind";

import { ChatHistoryContent } from "@/components/history/chat-history-content";
import { Icon } from "@/components/ui/icon";
import { usePearlDrawer } from "@/components/navigation/drawer-context";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import { initials as viewerInitials } from "@/src/initials";
import { fetchProjects, type ProjectDto } from "@/src/projects-client";

const CHAT_PILL_BLUE = "#007AFF";
const PINNED_LIMIT = 4;

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
    label: "Workspaces",
    href: "/workspaces",
    Icon: FolderIcon,
  },
] as const;

type DrawerPanelNav = {
  closeDrawer?: () => void;
};

/**
 * ChatGPT-style drawer body: brand + search, icon nav, pinned projects,
 * flat chat history, bottom Chat pill + profile.
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
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const mutedForeground = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const mutedColor = useCSSVariable("--color-muted") as string | undefined;
  const pageBackground = useCSSVariable("--color-background") as
    | string
    | undefined;
  const [drawerSearchOpen, setDrawerSearchOpen] = useState(false);
  const [projects, setProjects] = useState<readonly ProjectDto[]>([]);
  const profileInitials = isAnonymous
    ? null
    : viewerInitials(viewerName, viewerEmail);

  useEffect(() => {
    let cancelled = false;
    void fetchProjects()
      .then((rows) => {
        if (cancelled) return;
        const sorted = [...rows].sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        );
        setProjects(sorted.slice(0, PINNED_LIMIT));
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: pageBackground ?? "#F7F7F8",
        paddingBottom: Math.max(insets.bottom, 12),
        paddingTop: Math.max(insets.top, 8),
      }}
    >
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 4,
          gap: 10,
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
              backgroundColor: mutedColor ?? "#EFEFF0",
            }}
          >
            <Icon
              as={drawerSearchOpen ? XIcon : SearchIcon}
              className="size-4 text-foreground"
            />
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <ChatHistoryContent
          chrome="drawer"
          showInlineSearch={drawerSearchOpen}
          onOpenChat={openChatFromDrawer}
          onSeeAll={openSeeAll}
          drawerHeader={
            <View style={{ paddingHorizontal: 8, paddingBottom: 8, gap: 2 }}>
              {NAV_ROWS.map((row) => (
                <DrawerNavRow
                  key={row.href}
                  label={row.label}
                  icon={row.Icon}
                  onPress={() => go(row.href)}
                  color={foregroundColor}
                />
              ))}
              {projects.length > 0 ? (
                <View style={{ marginTop: 14, gap: 2 }}>
                  <Text
                    style={{
                      color: mutedForeground ?? "#8E8E93",
                      fontSize: 13,
                      fontWeight: "600",
                      paddingHorizontal: 12,
                      paddingBottom: 6,
                    }}
                  >
                    Pinned
                  </Text>
                  {projects.map((project) => (
                    <DrawerNavRow
                      key={project.id}
                      label={project.name}
                      icon={FolderIcon}
                      onPress={() =>
                        go(`/workspaces/projects/${project.id}`, {
                          withAnchor: true,
                        })
                      }
                      color={foregroundColor}
                    />
                  ))}
                </View>
              ) : null}
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: "rgba(0,0,0,0.08)",
                  marginHorizontal: 12,
                  marginTop: 12,
                  marginBottom: 4,
                }}
              />
            </View>
          }
        />
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
            backgroundColor: isAnonymous
              ? mutedColor ?? "#E5E5EA"
              : "#2A9D8F",
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
  );
}

/** @deprecated Prefer DrawerPanel */
export const HistoryDrawerPanel = DrawerPanel;

function DrawerNavRow({
  label,
  icon: RowIcon,
  onPress,
  color,
}: {
  readonly label: string;
  readonly icon: typeof InboxIcon;
  readonly onPress: (event: GestureResponderEvent) => void;
  readonly color?: string;
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
        backgroundColor: pressed ? "rgba(0,0,0,0.04)" : "transparent",
      })}
    >
      <Icon as={RowIcon} className="size-5 text-foreground" />
      <Text
        style={{
          color: color ?? "#111",
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
