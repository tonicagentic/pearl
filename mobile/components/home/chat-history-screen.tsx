import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { FlatList } from "react-native-gesture-handler";
import { router, Stack, useFocusEffect } from "expo-router";
import { FolderIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { ChatHistoryListIOS } from "@/components/home/chat-history-list";
import type { HistoryChatActionHandlers } from "@/components/home/history-list";
import { ProjectPickerModal } from "@/components/project-picker-modal";
import { ThreadCostDrawer } from "@/components/thread-cost-drawer";
import { Icon } from "@/components/ui/icon";
import {
  MATRIX_DOT_LOADER_SIZE,
  MatrixDotLoader,
} from "@/components/ui/matrix-dot-loader";
import { StackScreen } from "@/components/ui/stack-screen";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import { getChat, type ChatListItem } from "@/src/chats-client";
import {
  CHAT_PRESENCE_AMBER,
  CHAT_PRESENCE_BLUE,
  chatListPresence,
  chatPresenceAccessibilityLabel,
} from "@/src/chat-presence";
import { formatChatUpdatedAt } from "@/src/format-chat-updated-at";
import { fetchProjects, type ProjectDto } from "@/src/projects-client";
import type { ThreadTraceEvent } from "@/src/thread-trace";

/** Full chat history list (former home Recents). */
export function ChatHistoryScreen() {
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const { deleteChat, renameChat, setChatProject, reloadChats } = useChats();

  const [costOpen, setCostOpen] = useState(false);
  const [costEvents, setCostEvents] = useState<readonly ThreadTraceEvent[]>(
    [],
  );
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectTargetId, setProjectTargetId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void reloadChats({ silent: true });
    }, [reloadChats]),
  );

  const openChat = useCallback((_chatId: string) => {
    router.push("/chat");
  }, []);

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

  return (
    <StackScreen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "History",
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: foregroundColor,
        }}
      />
      {Platform.OS === "ios" ? (
        <ChatHistoryListIOS
          onOpenChat={openChat}
          actions={chatActions}
        />
      ) : (
        <ChatHistoryListAndroid
          onOpenChat={openChat}
          actions={chatActions}
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
    </StackScreen>
  );
}

function ChatHistoryListAndroid({
  onOpenChat,
  actions,
}: {
  readonly onOpenChat: (chatId: string) => void;
  readonly actions: HistoryChatActionHandlers;
}) {
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
  const pageBackground = useCSSVariable("--color-background") as
    | string
    | undefined;
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

  const emptyLabel =
    chatsLoading || (signedIn && !chatsReady)
      ? "Loading history…"
      : chatsError
        ? "Couldn’t load history"
        : "Sign in to see chats";

  return (
    <View style={{ flex: 1, backgroundColor: pageBackground }}>
      <FlatList
        className="flex-1"
        contentContainerClassName="px-4 pt-0"
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
        data={chats}
        extraData={`${activeChatId}:${chats.map((chat) => chat.presence ?? (chat.waitingForInput ? "waiting" : "idle")).join("")}`}
        keyExtractor={(chat) => chat.id}
        ItemSeparatorComponent={() => (
          <View className="ml-7 border-b border-border/60" />
        )}
        ListHeaderComponent={
          <>
            {selectionError ? (
              <Text
                className="px-3 py-2 text-sm text-destructive"
                accessibilityRole="alert"
              >
                {selectionError}
              </Text>
            ) : null}
            {chatsError && chats.length > 0 ? (
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
          </>
        }
        ListEmptyComponent={
          <View className="px-3 py-8">
            <Text className="text-muted-foreground text-sm">{emptyLabel}</Text>
          </View>
        }
        ListFooterComponent={
          hasMoreChats ? (
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
          ) : undefined
        }
        renderItem={({ item: chat }) => (
          <HistoryChatRowAndroid
            chat={chat}
            selected={activeChatId === chat.id}
            mutedDot={mutedDot}
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
}: {
  readonly chat: ChatListItem;
  readonly selected: boolean;
  readonly mutedDot: string;
  readonly projectName: string | null;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
}) {
  const presence = chatListPresence(chat);
  const when = formatChatUpdatedAt(chat.updatedAt);
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
      className={`min-h-12 flex-row items-center gap-2.5 rounded-lg px-3 ${selected ? "bg-muted/50" : ""}`}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
      {presence === "working" ? (
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
        {projectName ? (
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
