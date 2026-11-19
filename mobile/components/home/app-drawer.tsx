import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { FlatList } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { FolderIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { EmptyChatsCard } from "@/components/home/empty-chats-card";
import { ProjectMark } from "@/components/project-mark";
import { Icon } from "@/components/ui/icon";
import { Text as AppText } from "@/components/ui/text";
import {
  HistoryListIOS,
  type HistoryChatActionHandlers,
} from "@/components/home/history-list";
import {
  MATRIX_DOT_LOADER_SIZE,
  MatrixDotLoader,
} from "@/components/ui/matrix-dot-loader";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import type { ChatListItem } from "@/src/chats-client";
import {
  CHAT_PRESENCE_AMBER,
  CHAT_PRESENCE_BLUE,
  chatListPresence,
  chatPresenceAccessibilityLabel,
} from "@/src/chat-presence";
import { formatChatUpdatedAt } from "@/src/format-chat-updated-at";
import {
  fetchCustomAgents,
  type CustomAgentDto,
} from "@/src/custom-agents-client";
import { fetchProjects, type ProjectDto } from "@/src/projects-client";

export type { HistoryChatActionHandlers };

/**
 * Home list: recent chats.
 * Selecting a chat opens the nested `/chat` route.
 * Settings and New chat live in the native stack header.
 */
export function HistoryScreen({
  onOpenChat,
  visible = true,
  chatActions,
  bottomInset = 0,
  onCreateProject,
  onCreateAgent,
}: {
  /** Called after selecting an existing chat (caller should push `/chat`). */
  onOpenChat?: () => void;
  visible?: boolean;
  /** iOS swipe / context-menu handlers (required on iOS for row actions). */
  chatActions?: HistoryChatActionHandlers;
  readonly bottomInset?: number;
  /** Opens the new-project composer (empty Projects row + home New menu). */
  readonly onCreateProject?: () => void;
  /** Opens the new-agent composer (empty Agents row). */
  readonly onCreateAgent?: () => void;
}) {
  const openChatRoute = () => {
    if (onOpenChat) onOpenChat();
    else router.push("/chat");
  };

  if (Platform.OS === "ios") {
    const actions: HistoryChatActionHandlers = chatActions ?? {
      onRename: () => {},
      onViewCost: () => {},
      onMoveToProject: () => {},
      onRemoveFromProject: () => {},
      onDelete: () => {},
    };
    return (
      <View style={{ flex: 1 }} accessibilityElementsHidden={!visible}>
        <HistoryListIOS
          onOpenChat={openChatRoute}
          actions={actions}
          bottomInset={bottomInset}
          onCreateProject={onCreateProject}
          onCreateAgent={onCreateAgent}
        />
      </View>
    );
  }

  return (
    <HistoryListAndroid
      visible={visible}
      onOpenChat={openChatRoute}
      chatActions={chatActions}
      bottomInset={bottomInset}
      onCreateAgent={onCreateAgent}
    />
  );
}

function HistoryListAndroid({
  visible,
  onOpenChat,
  chatActions,
  bottomInset = 0,
  onCreateAgent,
}: {
  readonly visible: boolean;
  readonly onOpenChat: () => void;
  readonly onCreateAgent?: () => void;
  readonly chatActions?: HistoryChatActionHandlers;
  readonly bottomInset?: number;
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
  const [agents, setAgents] = useState<readonly CustomAgentDto[] | null>(null);
  const orderedProjects = useMemo(
    () =>
      [...(projects ?? [])].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    [projects],
  );
  const orderedAgents = useMemo(
    () =>
      [...(agents ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [agents],
  );
  const projectNames = useMemo(
    () => new Map(orderedProjects.map((project) => [project.id, project.name])),
    [orderedProjects],
  );
  const pageBackground = useCSSVariable("--color-background") as
    | string
    | undefined;
  const backgroundColor = pageBackground;
  const borderColor = useCSSVariable("--color-border") as string | undefined;
  const mutedDot = borderColor ?? "#3A3A3C";
  const showEmptyCard =
    chatsReady &&
    signedIn &&
    chats.length === 0 &&
    !chatsLoading &&
    !chatsError &&
    !selectionError;

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
      void fetchCustomAgents()
        .then((rows) => {
          if (!cancelled) setAgents(rows);
        })
        .catch(() => {
          if (!cancelled) setAgents((current) => current ?? []);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const openChatActions = (chat: ChatListItem) => {
    if (!chatActions) return;
    const projectId = chat.projectId ?? null;
    Alert.alert(chat.title, undefined, [
      { text: "Rename", onPress: () => chatActions.onRename(chat) },
      { text: "View cost", onPress: () => chatActions.onViewCost(chat) },
      {
        text: projectId ? "Move to project" : "Add to project",
        onPress: () => chatActions.onMoveToProject(chat),
      },
      ...(projectId
        ? [
            {
              text: "Remove from project",
              onPress: () => chatActions.onRemoveFromProject(chat),
            },
          ]
        : []),
      {
        text: "Delete",
        style: "destructive" as const,
        onPress: () => chatActions.onDelete(chat),
      },
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor }}
      edges={["left", "right", "bottom"]}
      accessibilityElementsHidden={!visible}
    >
      <View style={{ flex: 1 }}>
        <FlatList
          className="flex-1"
          contentContainerClassName="px-4 pt-0"
          contentContainerStyle={{
            paddingBottom: 32 + bottomInset,
            flexGrow: showEmptyCard && orderedProjects.length === 0 ? 1 : undefined,
            justifyContent:
              showEmptyCard && orderedProjects.length === 0
                ? "center"
                : undefined,
          }}
          data={chats}
          extraData={`${activeChatId}:${chats.map((chat) => chat.presence ?? (chat.waitingForInput ? "waiting" : "idle")).join("")}`}
          keyExtractor={(chat) => chat.id}
          ItemSeparatorComponent={() => (
            <View className="ml-7 border-b border-border/60" />
          )}
          renderItem={({ item: chat }) => (
            <RecentChatRowAndroid
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
                  if (selected) onOpenChat();
                });
              }}
              onLongPress={
                chatActions ? () => openChatActions(chat) : undefined
              }
            />
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
            showEmptyCard ? (
              <EmptyChatsCard />
            ) : (
              <View
                className="px-3 py-8"
                accessible
                accessibilityRole="summary"
                accessibilityLabel={
                  chatsLoading || (signedIn && !chatsReady)
                    ? "Loading history"
                    : chatsError
                      ? "Could not load history"
                      : "Sign in to see your chats"
                }
              >
                {chatsLoading || (signedIn && !chatsReady) ? (
                  <Text className="text-muted-foreground text-sm">
                    Loading history…
                  </Text>
                ) : chatsError ? (
                  <>
                    <Text className="text-base font-medium text-foreground">
                      Couldn’t load history
                    </Text>
                    <Text className="text-muted-foreground mt-1.5 text-sm leading-5">
                      Check your connection and try again.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Retry loading history"
                      className="mt-4 min-h-11 justify-center self-start"
                      onPress={() => void reloadChats()}
                    >
                      <Text className="text-sm font-medium text-foreground">
                        Try again
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text className="text-base font-medium text-foreground">
                      Sign in to see chats
                    </Text>
                    <Text className="text-muted-foreground mt-1.5 text-sm leading-5">
                      Your recent conversations appear here after you sign in.
                    </Text>
                  </>
                )}
              </View>
            )
          }
          ListFooterComponent={
            <>
              {hasMoreChats ? (
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
              {orderedProjects.length > 0 ? (
                <View className="mt-6">
                  <AppText
                    variant="secondary"
                    weight="medium"
                    className="mb-1 px-3"
                  >
                    Projects
                  </AppText>
                  {orderedProjects.map((project) => (
                    <Pressable
                      key={project.id}
                      accessibilityRole="button"
                      accessibilityLabel={project.name}
                      className="min-h-12 flex-row items-center gap-3 px-3 py-2"
                      onPress={() =>
                        router.push(
                          `/projects/${encodeURIComponent(project.id)}`,
                        )
                      }
                    >
                      <ProjectMark name={project.name} size="sm" />
                      <AppText variant="body" weight="medium" numberOfLines={1}>
                        {project.name}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {orderedAgents.length > 0 || onCreateAgent ? (
                <View className="mt-6">
                  <View className="mb-1 flex-row items-center justify-between px-3">
                    <AppText variant="secondary" weight="medium">
                      Agents
                    </AppText>
                    {onCreateAgent ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="New agent"
                        className="min-h-8 justify-center px-1"
                        onPress={onCreateAgent}
                      >
                        <AppText variant="secondary" weight="medium">
                          New
                        </AppText>
                      </Pressable>
                    ) : null}
                  </View>
                  {orderedAgents.length === 0 ? (
                    onCreateAgent ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="New agent"
                        className="min-h-12 flex-row items-center gap-3 px-3 py-2"
                        onPress={onCreateAgent}
                      >
                        <View
                          className="size-3.5 items-center justify-center rounded-full"
                          style={{ backgroundColor: "#2DD4BF" }}
                        >
                          <View className="flex-row gap-0.5">
                            <View className="h-1.5 w-0.5 rounded-full bg-white" />
                            <View className="h-1.5 w-0.5 rounded-full bg-white" />
                          </View>
                        </View>
                        <AppText variant="body" weight="medium">
                          New Agent
                        </AppText>
                      </Pressable>
                    ) : null
                  ) : (
                    orderedAgents.map((agent) => (
                      <Pressable
                        key={agent.id}
                        accessibilityRole="button"
                        accessibilityLabel={agent.name}
                        className="min-h-12 flex-row items-center gap-3 px-3 py-2"
                        onPress={() => {
                          void selectChat(agent.chatId).then((selected) => {
                            if (selected) onOpenChat();
                          });
                        }}
                      >
                        <View
                          className="size-3.5 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: agent.accent || "#2DD4BF",
                          }}
                        >
                          <View className="flex-row gap-0.5">
                            <View className="h-1.5 w-0.5 rounded-full bg-white" />
                            <View className="h-1.5 w-0.5 rounded-full bg-white" />
                          </View>
                        </View>
                        <AppText variant="body" weight="medium" numberOfLines={1}>
                          {agent.name}
                        </AppText>
                      </Pressable>
                    ))
                  )}
                </View>
              ) : null}
            </>
          }
        />
      </View>
    </SafeAreaView>
  );
}

function RecentChatRowAndroid({
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
        <MatrixDotLoader
          baseColor={mutedDot}
          activeColor={CHAT_PRESENCE_BLUE}
        />
      ) : (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          className="shrink-0 rounded-full"
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
