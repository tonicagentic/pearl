import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  Button,
  ContextMenu,
  Host,
  HStack,
  Image,
  List,
  ProgressView,
  Section,
  Spacer,
  SwipeActions,
  Text as SwiftText,
  VStack,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  clipped,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  listRowInsets,
  listStyle,
  opacity,
  padding,
  scrollContentBackground,
  scrollEdgeEffectStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useCSSVariable } from "uniwind";

import type { ChatHistorySearchFeed } from "@/components/home/chat-history-types";
import type { HistoryChatActionHandlers } from "@/components/home/history-list";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import type { ChatListItem } from "@/src/chats-client";
import {
  CHAT_PRESENCE_AMBER,
  CHAT_PRESENCE_BLUE,
  chatListPresence,
} from "@/src/chat-presence";
import { formatChatUpdatedAt } from "@/src/format-chat-updated-at";
import { fetchProjects, type ProjectDto } from "@/src/projects-client";

const PRESENCE_SLOT = 14;

/** iOS History: inset-grouped chat list with swipe and context actions. */
export function ChatHistoryListIOS({
  onOpenChat,
  actions,
  search,
}: {
  readonly onOpenChat: (chatId: string) => void;
  readonly actions: HistoryChatActionHandlers;
  readonly search: ChatHistorySearchFeed;
}) {
  const { signedIn } = useAuth();
  const {
    chats,
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
  const pageBackground = useCSSVariable("--color-background") as
    | string
    | undefined;
  const backgroundColor = pageBackground ?? "#FFFFFF";
  const mutedForeground = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const mutedColor = mutedForeground ?? "#8E8E93";
  const rowChrome = [
    listRowInsets({ top: 10, bottom: 10, leading: 16, trailing: 16 }),
  ];

  const [projects, setProjects] = useState<readonly ProjectDto[] | null>(null);
  const projectNames = useMemo(
    () =>
      new Map(
        [...(projects ?? [])].map((project) => [project.id, project.name]),
      ),
    [projects],
  );

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

  const openChat = useCallback(
    (chatId: string) => {
      void selectChat(chatId).then((selected) => {
        if (selected) onOpenChat(chatId);
      });
    },
    [onOpenChat, selectChat],
  );

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
    <View style={{ flex: 1, backgroundColor, overflow: "hidden" }}>
      <Host style={{ flex: 1, backgroundColor }}>
        <List
          modifiers={[
            listStyle("insetGrouped"),
            scrollContentBackground("hidden"),
            scrollEdgeEffectStyle("soft"),
          ]}
        >
          <Section>
            {!search.active && selectionError ? (
              <SwiftText
                modifiers={[
                  foregroundStyle("#FF453A"),
                  font({ size: 15 }),
                  ...rowChrome,
                ]}
              >
                {selectionError}
              </SwiftText>
            ) : null}
            {!search.active && chatsError && chats.length > 0 ? (
              <Button
                label={`${chatsError} Tap to retry.`}
                onPress={() => void reloadChats()}
                modifiers={[buttonStyle("plain"), ...rowChrome]}
              />
            ) : null}
            {search.active && search.error ? (
              <SwiftText
                modifiers={[
                  foregroundStyle("#FF453A"),
                  font({ size: 15 }),
                  ...rowChrome,
                ]}
              >
                {search.error}
              </SwiftText>
            ) : null}

            {rows.length === 0 ? (
              <SwiftText
                modifiers={[
                  foregroundStyle({ type: "hierarchical", style: "secondary" }),
                  font({ size: 15 }),
                  ...rowChrome,
                ]}
              >
                {emptyLabel}
              </SwiftText>
            ) : (
              <List.ForEach
                data={rows}
                keyExtractor={(chat) => chat.id}
                estimatedItemSize={64}
                recycling={false}
              >
                {({ item: chat }) => (
                  <RecentChatRow
                    chat={chat}
                    mutedColor={mutedColor}
                    projectName={
                      chat.projectId
                        ? (projectNames.get(chat.projectId) ?? "Project")
                        : null
                    }
                    onOpen={() => openChat(chat.id)}
                    actions={actions}
                  />
                )}
              </List.ForEach>
            )}

            {!search.active && hasMoreChats ? (
              <Button
                label={chatsLoading ? "Loading…" : "Load more"}
                onPress={() => void loadMoreChats()}
                modifiers={[buttonStyle("plain"), ...rowChrome]}
              />
            ) : null}
          </Section>
        </List>
      </Host>
    </View>
  );
}

function RecentChatRow({
  chat,
  mutedColor,
  projectName,
  onOpen,
  actions,
}: {
  readonly chat: ChatListItem;
  readonly mutedColor: string;
  readonly projectName: string | null;
  readonly onOpen: () => void;
  readonly actions: HistoryChatActionHandlers;
}) {
  const presence = chatListPresence(chat);
  const when = formatChatUpdatedAt(chat.updatedAt);
  const projectId = chat.projectId ?? null;
  const markTint =
    presence === "waiting"
      ? CHAT_PRESENCE_AMBER
      : presence === "unread"
        ? CHAT_PRESENCE_BLUE
        : null;
  const statusMark =
    presence === "working" ? (
      <ProgressView
        modifiers={[
          frame({ width: PRESENCE_SLOT, height: PRESENCE_SLOT }),
          clipped(true),
          tint(mutedColor),
        ]}
      />
    ) : (
      <Image
        systemName="circle.fill"
        size={8}
        modifiers={[
          frame({ width: PRESENCE_SLOT, height: PRESENCE_SLOT }),
          tint(markTint ?? mutedColor),
          opacity(markTint ? 1 : 0),
        ]}
      />
    );
  const row = (
    <Button onPress={onOpen} modifiers={[buttonStyle("plain")]}>
      <HStack
        spacing={12}
        alignment="center"
        modifiers={[padding({ vertical: 2 })]}
      >
        {statusMark}
        <VStack spacing={2} alignment="leading">
          <SwiftText modifiers={[lineLimit(1), font({ size: 17 })]}>
            {chat.title}
          </SwiftText>
          {projectName ? (
            <HStack spacing={4} alignment="center">
              <Image
                systemName="folder.fill"
                size={11}
                modifiers={[tint(mutedColor)]}
              />
              <SwiftText
                modifiers={[
                  lineLimit(1),
                  font({ size: 12 }),
                  foregroundStyle({
                    type: "hierarchical",
                    style: "secondary",
                  }),
                ]}
              >
                {projectName}
              </SwiftText>
            </HStack>
          ) : null}
        </VStack>
        <Spacer />
        {when ? (
          <SwiftText
            modifiers={[
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              font({ size: 13 }),
            ]}
          >
            {when}
          </SwiftText>
        ) : null}
      </HStack>
    </Button>
  );

  return (
    <SwipeActions
      modifiers={[
        listRowInsets({ top: 10, bottom: 10, leading: 16, trailing: 16 }),
      ]}
    >
      <ContextMenu>
        <ContextMenu.Trigger>{row}</ContextMenu.Trigger>
        <ContextMenu.Items>
          <Button
            label="Rename"
            systemImage="pencil"
            onPress={() => actions.onRename(chat)}
          />
          <Button
            label="View cost"
            systemImage="dollarsign.circle"
            onPress={() => actions.onViewCost(chat)}
          />
          <Button
            label={projectId ? "Move to project" : "Add to project"}
            systemImage="folder"
            onPress={() => actions.onMoveToProject(chat)}
          />
          {projectId ? (
            <Button
              label="Remove from project"
              systemImage="folder.badge.minus"
              onPress={() => actions.onRemoveFromProject(chat)}
            />
          ) : null}
          <Button
            label="Delete"
            systemImage="trash"
            role="destructive"
            onPress={() => actions.onDelete(chat)}
          />
        </ContextMenu.Items>
      </ContextMenu>
      <SwipeActions.Actions edge="leading">
        <Button
          label={projectId ? "Move" : "Project"}
          systemImage={projectId ? "folder" : "folder.badge.plus"}
          onPress={() => actions.onMoveToProject(chat)}
        />
      </SwipeActions.Actions>
      <SwipeActions.Actions edge="trailing" allowsFullSwipe>
        <Button
          label="Delete"
          systemImage="trash"
          role="destructive"
          onPress={() => actions.onDelete(chat)}
        />
      </SwipeActions.Actions>
    </SwipeActions>
  );
}
