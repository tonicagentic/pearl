import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Alert,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { FlatList } from "react-native-gesture-handler";
import { useFocusEffect } from "expo-router";
import { FolderIcon, SearchIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { ChatHistoryListIOS } from "@/components/history/chat-history-list";
import type { ChatHistorySearchFeed } from "@/components/history/chat-history-types";
import type { HistoryChatActionHandlers } from "@/components/home/history-list";
import { ProjectPickerModal } from "@/components/project-picker-modal";
import { ThreadCostDrawer } from "@/components/thread-cost-drawer";
import { Icon } from "@/components/ui/icon";
import {
  MATRIX_DOT_LOADER_SIZE,
  MatrixDotLoader,
} from "@/components/ui/matrix-dot-loader";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import {
  getChat,
  searchChats,
  type ChatListItem,
} from "@/src/chats-client";
import {
  CHAT_PRESENCE_AMBER,
  CHAT_PRESENCE_BLUE,
  chatListPresence,
  chatPresenceAccessibilityLabel,
} from "@/src/chat-presence";
import { formatChatUpdatedAt } from "@/src/format-chat-updated-at";
import {
  usePearlDrawerBackground,
  usePearlDrawerSelectedBackground,
  usePearlForeground,
  usePearlMutedBackground,
  usePearlScreenBackground,
} from "@/src/navigation-theme";
import { fetchProjects, type ProjectDto } from "@/src/projects-client";
import type { ThreadTraceEvent } from "@/src/thread-trace";
import { useStackSearch } from "@/src/use-stack-search";

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Shared history list body for the `/history` route and the swipe sidebar.
 * Pass `search` from a Stack.SearchBar host, or omit it to use an inline field.
 * `chrome="drawer"` uses a flat list; optional `drawerHeader` / `onSeeAll` for
 * the ChatGPT-style panel chrome.
 */
export function ChatHistoryContent({
  onOpenChat,
  search: externalSearch,
  showInlineSearch = false,
  chrome = "page",
  topInset = 0,
  drawerHeader,
  onSeeAll,
  contentBottomInset = 0,
}: {
  readonly onOpenChat: (chatId: string) => void;
  readonly search?: ReturnType<typeof useStackSearch>;
  readonly showInlineSearch?: boolean;
  readonly chrome?: "page" | "drawer";
  readonly topInset?: number;
  /** Scrolls with the list (drawer brand / nav / Recent chats). */
  readonly drawerHeader?: ReactNode;
  readonly onSeeAll?: () => void;
  /** Extra list bottom padding so rows clear a sticky footer. */
  readonly contentBottomInset?: number;
}) {
  const { deleteChat, renameChat, setChatProject, reloadChats } = useChats();
  const inlineSearch = useStackSearch();
  const search = externalSearch ?? inlineSearch;
  const isDrawer = chrome === "drawer";

  const [costOpen, setCostOpen] = useState(false);
  const [costEvents, setCostEvents] = useState<readonly ThreadTraceEvent[]>(
    [],
  );
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectTargetId, setProjectTargetId] = useState<string | null>(null);
  const [searchHits, setSearchHits] = useState<readonly ChatListItem[] | null>(
    null,
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchGen = useRef(0);
  const mutedForeground = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const foregroundColor = usePearlForeground();
  const mutedColor = usePearlMutedBackground();
  const pageBackground = usePearlScreenBackground();
  const drawerBackground = usePearlDrawerBackground();
  const listBackground = isDrawer ? drawerBackground : pageBackground;

  useFocusEffect(
    useCallback(() => {
      void reloadChats({ silent: true });
    }, [reloadChats]),
  );

  useEffect(() => {
    if (!showInlineSearch) {
      search.setQueryText("");
    }
  }, [showInlineSearch, search]);

  useEffect(() => {
    if (!search.active) {
      searchGen.current += 1;
      setSearchHits(null);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    const gen = ++searchGen.current;
    setSearchLoading(true);
    const timer = setTimeout(() => {
      void searchChats(search.trimmed)
        .then((hits) => {
          if (gen !== searchGen.current) return;
          setSearchHits(
            hits.map((hit) => ({
              id: hit.id,
              title: hit.title,
              updatedAt: hit.updatedAt,
              projectId: hit.projectId,
              waitingForInput: hit.waitingForInput,
              presence: hit.presence,
            })),
          );
          setSearchError(null);
        })
        .catch(() => {
          if (gen !== searchGen.current) return;
          setSearchHits([]);
          setSearchError("Could not search. Check your connection.");
        })
        .finally(() => {
          if (gen !== searchGen.current) return;
          setSearchLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search.active, search.trimmed]);

  const searchFeed = useMemo<ChatHistorySearchFeed>(
    () => ({
      active: search.active,
      loading: searchLoading,
      error: searchError,
      hits: searchHits,
    }),
    [search.active, searchLoading, searchError, searchHits],
  );

  const promptRename = useCallback(
    (chat: ChatListItem) => {
      if (Platform.OS === "ios" && typeof Alert.prompt === "function") {
        Alert.prompt(
          "Rename chat",
          undefined,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Save",
              onPress: (value?: string) => {
                const next = value?.trim();
                if (!next || next === chat.title) return;
                void renameChat(chat.id, next).catch(() => {
                  Alert.alert(
                    "Could not rename",
                    "Check your connection and try again.",
                  );
                });
              },
            },
          ],
          "plain-text",
          chat.title,
        );
        return;
      }
      Alert.alert("Rename", "Renaming is available on iOS.");
    },
    [renameChat],
  );

  const confirmDelete = useCallback(
    (chat: ChatListItem) => {
      Alert.alert("Delete thread?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteChat(chat.id).catch(() => {
              Alert.alert(
                "Could not delete",
                "Check your connection and try again.",
              );
            });
          },
        },
      ]);
    },
    [deleteChat],
  );

  const openCost = useCallback((chat: ChatListItem) => {
    void getChat(chat.id)
      .then((full) => {
        setCostEvents((full?.events ?? []) as readonly ThreadTraceEvent[]);
        setCostOpen(true);
      })
      .catch(() => {
        Alert.alert(
          "Could not open cost",
          "Check your connection and try again.",
        );
      });
  }, []);

  const openProjectPicker = useCallback((chat: ChatListItem) => {
    setProjectTargetId(chat.id);
    setProjectPickerOpen(true);
  }, []);

  const removeFromProject = useCallback(
    (chat: ChatListItem) => {
      void setChatProject(chat.id, null).catch(() => {
        Alert.alert(
          "Could not update project",
          "Check your connection and try again.",
        );
      });
    },
    [setChatProject],
  );

  const chatActions = useMemo<HistoryChatActionHandlers>(
    () => ({
      onRename: promptRename,
      onViewCost: openCost,
      onMoveToProject: openProjectPicker,
      onRemoveFromProject: removeFromProject,
      onDelete: confirmDelete,
    }),
    [
      promptRename,
      openCost,
      openProjectPicker,
      removeFromProject,
      confirmDelete,
    ],
  );

  const searchField =
    showInlineSearch ? (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginHorizontal: isDrawer ? 20 : 16,
          marginBottom: 8,
          paddingHorizontal: 12,
          height: 40,
          borderRadius: 12,
          backgroundColor: mutedColor,
        }}
      >
        <Icon as={SearchIcon} className="size-4 text-muted-foreground" />
        <TextInput
          accessibilityLabel="Search history"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={isDrawer}
          clearButtonMode="while-editing"
          onChangeText={search.setQueryText}
          placeholder={isDrawer ? "Search" : "Search history"}
          placeholderTextColor={mutedForeground}
          style={{
            flex: 1,
            color: foregroundColor,
            fontSize: 16,
            paddingVertical: 0,
          }}
          value={search.query}
        />
      </View>
    ) : null;

  // Drawer: brand/nav/search scroll with the list. Page: search stays above.
  const scrollingHeader = isDrawer ? (
    <View>
      {drawerHeader}
      {searchField}
    </View>
  ) : null;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: listBackground,
        paddingTop: topInset,
      }}
    >
      {!isDrawer ? searchField : null}
      {!isDrawer && drawerHeader ? drawerHeader : null}
      {/* Drawer needs an RN list header (brand/nav). SwiftUI List + RNHostView
          collapses that row to zero height, so drawer always uses FlatList. */}
      {Platform.OS === "ios" && !isDrawer ? (
        <ChatHistoryListIOS
          onOpenChat={onOpenChat}
          actions={chatActions}
          search={searchFeed}
          chrome={chrome}
          onSeeAll={onSeeAll}
        />
      ) : (
        <ChatHistoryListAndroid
          onOpenChat={onOpenChat}
          actions={chatActions}
          search={searchFeed}
          chrome={chrome}
          onSeeAll={onSeeAll}
          listHeader={scrollingHeader}
          contentBottomInset={contentBottomInset}
        />
      )}
      <ThreadCostDrawer
        open={costOpen}
        events={costEvents}
        onClose={() => {
          setCostOpen(false);
          setCostEvents([]);
        }}
      />
      <ProjectPickerModal
        open={projectPickerOpen}
        onClose={() => {
          setProjectPickerOpen(false);
          setProjectTargetId(null);
        }}
        onSelect={(project) => {
          const chatId = projectTargetId;
          setProjectPickerOpen(false);
          setProjectTargetId(null);
          if (!chatId) return;
          void setChatProject(chatId, project.id).catch(() => {
            Alert.alert(
              "Could not update project",
              "Check your connection and try again.",
            );
          });
        }}
      />
    </View>
  );
}

export function ChatHistoryListAndroid({
  onOpenChat,
  actions,
  search,
  chrome = "page",
  onSeeAll,
  listHeader,
  contentBottomInset = 0,
}: {
  readonly onOpenChat: (chatId: string) => void;
  readonly actions: HistoryChatActionHandlers;
  readonly search: ChatHistorySearchFeed;
  readonly chrome?: "page" | "drawer";
  readonly onSeeAll?: () => void;
  readonly listHeader?: ReactNode;
  readonly contentBottomInset?: number;
}) {
  const isDrawer = chrome === "drawer";
  const { signedIn } = useAuth();
  const {
    chats,
    activeChatId,
    chatsLoading,
    chatsReady,
    chatsError,
    hasMoreChats,
    loadMoreChats,
    reloadChats,
    selectChat,
    selectionError,
  } = useChats();
  const rows = search.active ? (search.hits ?? []) : chats;
  const [projects, setProjects] = useState<readonly ProjectDto[] | null>(null);
  const projectNames = useMemo(
    () =>
      new Map(
        [...(projects ?? [])]
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .map((project) => [project.id, project.name]),
      ),
    [projects],
  );
  const pageBackground = usePearlScreenBackground();
  const drawerBackground = usePearlDrawerBackground();
  const listBackground = isDrawer ? drawerBackground : pageBackground;
  const borderColor = useCSSVariable("--color-border") as string | undefined;
  const mutedDot = borderColor ?? "#3A3A3C";

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchProjects()
        .then((rows) => {
          if (!cancelled) setProjects(rows);
        })
        .catch(() => {
          if (!cancelled) setProjects((current) => current ?? []);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const openChatActions = (chat: ChatListItem) => {
    const projectId = chat.projectId ?? null;
    Alert.alert(chat.title, undefined, [
      { text: "Rename", onPress: () => actions.onRename(chat) },
      { text: "View cost", onPress: () => actions.onViewCost(chat) },
      {
        text: projectId ? "Move to project" : "Add to project",
        onPress: () => actions.onMoveToProject(chat),
      },
      ...(projectId
        ? [
            {
              text: "Remove from project",
              onPress: () => actions.onRemoveFromProject(chat),
            },
          ]
        : []),
      {
        text: "Delete",
        style: "destructive" as const,
        onPress: () => actions.onDelete(chat),
      },
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  const emptyLabel = search.active
    ? search.loading
      ? "Searching…"
      : search.error
        ? search.error
        : "No chats match"
    : chatsLoading || (signedIn && !chatsReady)
      ? "Loading history…"
      : chatsError
        ? "Couldn’t load history"
        : "Sign in to see chats";

  return (
    <View style={{ flex: 1, backgroundColor: listBackground }}>
      <FlatList
        className="flex-1"
        contentContainerClassName={isDrawer ? "px-1 pt-0" : "px-4 pt-0"}
        contentContainerStyle={{
          paddingBottom: 32 + contentBottomInset,
          flexGrow: 1,
        }}
        data={rows}
        keyboardShouldPersistTaps="handled"
        extraData={`${activeChatId}:${search.active}:${rows.map((chat) => chat.presence ?? (chat.waitingForInput ? "waiting" : "idle")).join("")}`}
        keyExtractor={(chat) => chat.id}
        ItemSeparatorComponent={
          isDrawer
            ? undefined
            : () => <View className="ml-7 border-b border-border/60" />
        }
        ListHeaderComponent={
          <>
            {listHeader}
            {!search.active && selectionError ? (
              <Text
                className="px-3 py-2 text-sm text-destructive"
                accessibilityRole="alert"
              >
                {selectionError}
              </Text>
            ) : null}
            {!search.active && chatsError && chats.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                className="min-h-12 justify-center px-3"
                onPress={() => void reloadChats()}
              >
                <Text className="text-sm text-destructive">
                  {chatsError} Tap to retry.
                </Text>
              </Pressable>
            ) : null}
            {search.active && search.error ? (
              <Text
                className="px-3 py-2 text-sm text-destructive"
                accessibilityRole="alert"
              >
                {search.error}
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View className="px-3 py-8">
            <Text className="text-muted-foreground text-sm">{emptyLabel}</Text>
          </View>
        }
        ListFooterComponent={
          <>
            {!search.active && hasMoreChats ? (
              <Pressable
                accessibilityRole="button"
                className="min-h-12 justify-center rounded-lg px-3"
                disabled={chatsLoading}
                onPress={() => void loadMoreChats()}
              >
                <Text className="text-sm text-muted-foreground">
                  {chatsLoading ? "Loading…" : "Load more"}
                </Text>
              </Pressable>
            ) : null}
            {isDrawer && onSeeAll && rows.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                className="min-h-12 justify-center px-5"
                onPress={onSeeAll}
              >
                <Text className="text-sm text-muted-foreground">See all…</Text>
              </Pressable>
            ) : null}
          </>
        }
        renderItem={({ item: chat }) => (
          <HistoryChatRowAndroid
            chat={chat}
            selected={activeChatId === chat.id}
            mutedDot={mutedDot}
            chrome={chrome}
            projectName={
              chat.projectId
                ? (projectNames.get(chat.projectId) ?? "Project")
                : null
            }
            onPress={() => {
              void selectChat(chat.id).then((selected) => {
                if (selected) onOpenChat(chat.id);
              });
            }}
            onLongPress={() => openChatActions(chat)}
          />
        )}
      />
    </View>
  );
}

function HistoryChatRowAndroid({
  chat,
  selected,
  mutedDot,
  projectName,
  onPress,
  onLongPress,
  chrome = "page",
}: {
  readonly chat: ChatListItem;
  readonly selected: boolean;
  readonly mutedDot: string;
  readonly projectName: string | null;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
  readonly chrome?: "page" | "drawer";
}) {
  const presence = chatListPresence(chat);
  const when = formatChatUpdatedAt(chat.updatedAt);
  const isDrawer = chrome === "drawer";
  const drawerSelectedBg = usePearlDrawerSelectedBackground();
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
      className={`min-h-12 flex-row items-center rounded-lg px-5 ${isDrawer ? "gap-0" : "gap-2.5 px-3"} ${selected && !isDrawer ? "bg-muted/50" : ""}`}
      style={
        selected && isDrawer ? { backgroundColor: drawerSelectedBg } : undefined
      }
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
      {isDrawer ? null : presence === "working" ? (
        <View
          style={{
            width: MATRIX_DOT_LOADER_SIZE,
            height: MATRIX_DOT_LOADER_SIZE,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MatrixDotLoader baseColor={mutedDot} />
        </View>
      ) : (
        <View
          style={{
            width: MATRIX_DOT_LOADER_SIZE,
            height: MATRIX_DOT_LOADER_SIZE,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {markColor ? (
            <View
              className="rounded-full"
              style={{
                width: 8,
                height: 8,
                backgroundColor: markColor,
              }}
            />
          ) : null}
        </View>
      )}
      <View className="min-w-0 flex-1">
        <Text className="text-base text-foreground" numberOfLines={1}>
          {chat.title}
        </Text>
        {!isDrawer && projectName ? (
          <View className="mt-0.5 min-w-0 flex-row items-center gap-1">
            <Icon
              as={FolderIcon}
              size={11}
              className="text-muted-foreground"
            />
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {projectName}
            </Text>
          </View>
        ) : null}
      </View>
      {when ? (
        <Text className="shrink-0 text-xs text-muted-foreground">{when}</Text>
      ) : null}
    </Pressable>
  );
}
