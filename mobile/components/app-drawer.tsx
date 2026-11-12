import { Platform, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { FlatList } from "react-native-gesture-handler";
import { FolderIcon, InboxIcon, PlusIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";
import {
  HistoryListIOS,
  type HistoryChatActionHandlers,
  type SidebarDestination,
} from "@/components/history-list";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import type { ChatListItem } from "@/src/chats-client";
import { formatChatUpdatedAt } from "@/src/format-chat-updated-at";

export type { HistoryChatActionHandlers, SidebarDestination };

/**
 * Home list: Projects, Tasks, and recent chats.
 * Selecting a chat or New chat opens the nested `/chat` route.
 * Settings lives in the native stack header.
 */
export function HistoryScreen({
  onOpenChat,
  onNavigate,
  visible = true,
  chatActions,
}: {
  /** Called after selecting an existing chat (caller should push `/chat`). */
  onOpenChat?: () => void;
  onNavigate?: (href: SidebarDestination) => void;
  visible?: boolean;
  /** iOS swipe / context-menu handlers (required on iOS for row actions). */
  chatActions?: HistoryChatActionHandlers;
}) {
  const openChatRoute = () => {
    if (onOpenChat) onOpenChat();
    else router.push("/chat");
  };

  const openDestination = (href: SidebarDestination) => {
    if (onNavigate) onNavigate(href);
    else router.push(href);
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
      <View
        style={{ flex: 1 }}
        accessibilityElementsHidden={!visible}
      >
        <HistoryListIOS
          onOpenChat={openChatRoute}
          onNavigate={openDestination}
          actions={actions}
        />
      </View>
    );
  }

  return (
    <HistoryListAndroid
      visible={visible}
      onOpenChat={openChatRoute}
      onNavigate={openDestination}
    />
  );
}

function HistoryListAndroid({
  visible,
  onOpenChat,
  onNavigate,
}: {
  readonly visible: boolean;
  readonly onOpenChat: () => void;
  readonly onNavigate: (href: SidebarDestination) => void;
}) {
  const { signedIn } = useAuth();
  const {
    chats,
    activeChatId,
    chatsLoading,
    chatsError,
    hasMoreChats,
    loadMoreChats,
    reloadChats,
    selectChat,
    selectionError,
    newChat,
  } = useChats();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const mutedDot =
    (useCSSVariable("--color-border") as string | undefined) ?? "#3A3A3C";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor }}
      edges={["left", "right", "bottom"]}
      accessibilityElementsHidden={!visible}
    >
      <View style={{ flex: 1 }}>
        <FlatList
          className="flex-1"
          contentContainerClassName="px-4 pb-8 pt-2"
          data={chats}
          extraData={`${activeChatId}:${chats.map((chat) => (chat.waitingForInput ? "1" : "0")).join("")}`}
          keyExtractor={(chat) => chat.id}
          ItemSeparatorComponent={() => (
            <View className="ml-7 border-b border-border/60" />
          )}
          renderItem={({ item: chat }) => (
            <RecentChatRowAndroid
              chat={chat}
              selected={activeChatId === chat.id}
              mutedDot={mutedDot}
              onPress={() => {
                void selectChat(chat.id).then((selected) => {
                  if (selected) onOpenChat();
                });
              }}
            />
          )}
          ListHeaderComponent={
            <>
              <Pressable
                accessibilityRole="button"
                className="min-h-12 flex-row items-center gap-3 rounded-lg px-3"
                onPress={() => onNavigate("/projects")}
              >
                <Icon as={FolderIcon} className="size-5 text-foreground" />
                <Text className="text-base text-foreground">Projects</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                className="min-h-12 flex-row items-center gap-3 rounded-lg px-3"
                onPress={() => onNavigate("/issues")}
              >
                <Icon as={InboxIcon} className="size-5 text-foreground" />
                <Text className="text-base text-foreground">Tasks</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                className="min-h-12 flex-row items-center gap-3 rounded-lg px-3"
                onPress={() => {
                  newChat();
                  onOpenChat();
                }}
              >
                <Icon as={PlusIcon} className="size-5 text-foreground" />
                <Text className="text-base text-foreground">New chat</Text>
              </Pressable>
              <Text className="px-3 pb-2 pt-5 text-xs font-medium uppercase text-muted-foreground">
                Chats
              </Text>
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
            <View
              className="px-3 py-8"
              accessible
              accessibilityRole="summary"
              accessibilityLabel={
                chatsLoading
                  ? "Loading history"
                  : chatsError
                    ? "Could not load history"
                    : signedIn
                      ? "No chats yet"
                      : "Sign in to see your chats"
              }
            >
              {chatsLoading ? (
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
                    {signedIn ? "No chats yet" : "Sign in to see chats"}
                  </Text>
                  <Text className="text-muted-foreground mt-1.5 text-sm leading-5">
                    {signedIn
                      ? "Start a conversation and it will show up here."
                      : "Your recent conversations appear here after you sign in."}
                  </Text>
                </>
              )}
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
        />
      </View>
    </SafeAreaView>
  );
}

function RecentChatRowAndroid({
  chat,
  selected,
  mutedDot,
  onPress,
}: {
  readonly chat: ChatListItem;
  readonly selected: boolean;
  readonly mutedDot: string;
  readonly onPress: () => void;
}) {
  const waiting = Boolean(chat.waitingForInput);
  const when = formatChatUpdatedAt(chat.updatedAt);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={
        waiting
          ? `${chat.title}, waiting for your reply`
          : chat.title
      }
      className={`min-h-12 flex-row items-center gap-2.5 rounded-lg px-3 ${selected ? "bg-muted/50" : ""}`}
      onPress={onPress}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: waiting ? "#F59E0B" : mutedDot }}
      />
      <Text
        className="flex-1 text-base text-foreground"
        numberOfLines={1}
      >
        {chat.title}
      </Text>
      {when ? (
        <Text className="shrink-0 text-xs text-muted-foreground">{when}</Text>
      ) : null}
    </Pressable>
  );
}
