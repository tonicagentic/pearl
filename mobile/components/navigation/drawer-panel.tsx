import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, usePathname } from "expo-router";
import {
  FolderIcon,
  LibraryIcon,
  SearchIcon,
  SquarePenIcon,
  TargetIcon,
  UserIcon,
  WalletIcon,
  ZapIcon,
} from "lucide-react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatHistoryContent } from "@/components/history/chat-history-content";
import {
  useDrawerSettleHaptic,
  usePearlDrawer,
} from "@/components/navigation/drawer-context";
import {
  DRAWER_EDGE,
  DRAWER_ROW_PAD_X,
  DrawerLinkRow,
  DrawerSectionLabel,
  isDrawerHrefActive,
} from "@/components/navigation/drawer-rows";
import { PearlIcon } from "@/components/pearl-icon";
import { projectMarkFor } from "@/components/project-mark";
import { Icon } from "@/components/ui/icon";
import { CreateProjectModal } from "@/components/workspaces/create-project-modal";
import { useAuth } from "@/src/auth";
import { useActiveChat } from "@/src/chat-context";
import { initials as viewerInitials } from "@/src/initials";
import {
  usePearlDrawerBackground,
  usePearlForeground,
  usePearlMutedBackground,
} from "@/src/navigation-theme";
import { drawerProjectHref } from "@/src/overview-ui";
import {
  fetchProjects,
  type ProjectDto,
} from "@/src/projects-client";
import { queryKeys } from "@/src/query-client";

/** Space reserved under the list so rows clear the profile footer. */
const FOOTER_CLEARANCE = 64;

/** Primary destinations after New Chat (no Track section). */
const PRIMARY_ROWS = [
  {
    label: "Automations",
    href: "/automations",
    Icon: ZapIcon,
  },
  {
    label: "Goals",
    href: "/goals",
    Icon: TargetIcon,
  },
  {
    label: "Library",
    href: "/library",
    Icon: LibraryIcon,
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
 * ChatGPT-style drawer: brand + search in the header, profile in the
 * sticky footer, full-screen search overlay for history.
 */
export function DrawerPanel({
  navigation,
}: {
  readonly navigation?: DrawerPanelNav;
} = {}) {
  useDrawerSettleHaptic();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const {
    closeDrawer: closePearlDrawer,
    onSelectChatFromDrawer,
    notifyChatSelectedFromDrawer,
  } = usePearlDrawer();
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
  const { newChat, activeChatId } = useActiveChat();
  const pathname = usePathname();
  const onChatRoute = isDrawerHrefActive(pathname, "/");
  // New Chat lights only on an empty home/chat session — not while a thread
  // is open, and not on Goals/Automations/… destinations.
  const newChatSelected = onChatRoute && activeChatId == null;
  const foregroundColor = usePearlForeground();
  const mutedColor = usePearlMutedBackground();
  const drawerBackground = usePearlDrawerBackground();
  const profileInitials = isAnonymous
    ? null
    : viewerInitials(viewerName, viewerEmail);
  const bottomPad = Math.max(insets.bottom, 12);
  const listBottomInset = FOOTER_CLEARANCE + bottomPad;
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: fetchProjects,
  });
  const drawerProjects = useMemo(
    () =>
      [...(projectsQuery.data ?? [])].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    [projectsQuery.data],
  );

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
    // Force the Chat tab (Overview is only via the home switcher).
    notifyChatSelectedFromDrawer({ tab: "pearl" });
    newChat();
    requestAnimationFrame(() => {
      router.navigate("/");
    });
  }, [closeDrawer, isAnonymous, newChat, notifyChatSelectedFromDrawer]);

  const openProfile = useCallback(() => {
    if (isAnonymous) {
      closeDrawer();
      requestAnimationFrame(() => {
        router.push("/sign-in");
      });
      return;
    }
    // Keep the drawer open under the Settings full-screen modal.
    router.push("/settings");
  }, [closeDrawer, isAnonymous]);

  const openSeeAll = useCallback(() => {
    go("/history");
  }, [go]);

  const openCreateProject = useCallback(() => {
    if (isAnonymous) {
      closeDrawer();
      requestAnimationFrame(() => {
        router.push("/sign-in");
      });
      return;
    }
    setCreateProjectOpen(true);
  }, [closeDrawer, isAnonymous]);

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
            accessibilityLabel="Search history"
            hitSlop={8}
            onPress={() => router.push("/chat-search")}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: mutedColor,
            }}
          >
            <Icon as={SearchIcon} className="size-4 text-foreground" />
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
        {PRIMARY_ROWS.map((row) => (
          <DrawerLinkRow
            key={row.href}
            label={row.label}
            icon={row.Icon}
            onPress={() => go(row.href)}
            selected={isDrawerHrefActive(pathname, row.href)}
          />
        ))}
        <DrawerSectionLabel
          actionLabel="+"
          actionAccessibilityLabel="New project"
          onActionPress={openCreateProject}
        >
          Projects
        </DrawerSectionLabel>
        <DrawerLinkRow
          label="All projects"
          icon={FolderIcon}
          onPress={() => go("/workspaces")}
          selected={
            isDrawerHrefActive(pathname, "/workspaces") &&
            !pathname.includes("/workspaces/projects/")
          }
        />
        {drawerProjects.map((project) => {
          const href = `/workspaces/projects/${encodeURIComponent(project.id)}`;
          return (
            <DrawerLinkRow
              key={project.id}
              label={project.name}
              icon={projectMarkFor(project.name).icon}
              onPress={() => go(drawerProjectHref(project.id))}
              selected={isDrawerHrefActive(pathname, href)}
            />
          );
        })}
        <DrawerSectionLabel>Recent chats</DrawerSectionLabel>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: drawerBackground }}>
      <View style={{ flex: 1 }}>
        <ChatHistoryContent
          chrome="drawer"
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
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingHorizontal: DRAWER_EDGE + DRAWER_ROW_PAD_X,
            paddingTop: 8,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isAnonymous ? "Sign in" : "Settings"}
            hitSlop={8}
            onPress={openProfile}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: mutedColor,
            }}
          >
            {isAnonymous ? (
              <Icon as={UserIcon} className="size-4 text-foreground" />
            ) : (
              <Text
                style={{
                  color: foregroundColor,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                {profileInitials ?? "·"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <CreateProjectModal
        open={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        onCreated={(project: ProjectDto) => {
          setCreateProjectOpen(false);
          queryClient.setQueryData<readonly ProjectDto[]>(
            queryKeys.projects,
            (current) =>
              current
                ? [project, ...current.filter((row) => row.id !== project.id)]
                : [project],
          );
          void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
          closeDrawer();
          requestAnimationFrame(() => {
            router.navigate(
              drawerProjectHref(project.id) as never,
            );
          });
        }}
      />
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
});
