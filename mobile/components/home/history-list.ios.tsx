import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
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
  listRowBackground,
  listRowInsets,
  listRowSpacing,
  listStyle,
  opacity,
  padding,
  scrollContentBackground,
  scrollEdgeEffectStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useCSSVariable } from "uniwind";

import { EmptyChatsCard } from "@/components/home/empty-chats-card";
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
import type { HistoryChatActionHandlers } from "@/components/home/history-list";

/** Fixed leading slot so titles stay aligned with or without a presence mark. */
const PRESENCE_SLOT = 14;

export type { HistoryChatActionHandlers } from "@/components/home/history-list";

/**
 * iOS home: plain List with swipe delete + context menu actions.
 */
export function HistoryListIOS({
  onOpenChat,
  actions,
  bottomInset = 0,
}: {
  readonly onOpenChat: () => void;
  readonly actions: HistoryChatActionHandlers;
  readonly bottomInset?: number;
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
  const pageBackground = useCSSVariable("--color-background") as
    | string
    | undefined;
  const backgroundColor = pageBackground ?? "#FFFFFF";
  // Transparent list chrome so rows can fade under the nav + composer; keep
  // opaque row fills for swipe/context targets.
  const rowBackground = backgroundColor;
  const clearRow = "#00000000";
  const mutedForeground = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const mutedColor = mutedForeground ?? "#8E8E93";
  const rowChrome = [
    listRowBackground(rowBackground),
    listRowInsets({ top: 10, bottom: 10, leading: 16, trailing: 16 }),
  ];

  const [projects, setProjects] = useState<readonly ProjectDto[] | null>(null);
  const orderedProjects = useMemo(
    () =>
      [...(projects ?? [])].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    [projects],
  );
  const projectNames = useMemo(
    () => new Map(orderedProjects.map((project) => [project.id, project.name])),
    [orderedProjects],
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
        if (selected) onOpenChat();
      });
    },
    [onOpenChat, selectChat],
  );

  const showEmptyCard =
    chatsReady &&
    signedIn &&
    chats.length === 0 &&
    !chatsLoading &&
    !chatsError &&
    !selectionError;
  const emptyLabel =
    chatsLoading || (signedIn && !chatsReady)
      ? "Loading history…"
      : chatsError
        ? "Couldn’t load history"
        : "Sign in to see chats";

  const showProjects = orderedProjects.length > 0;

  if (showEmptyCard && !showProjects) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor,
          paddingBottom: bottomInset,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <EmptyChatsCard />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        // Transparent — opaque fills here blocked scroll fade under the
        // header and left a solid pad above the floating composer.
        backgroundColor: "transparent",
        // Keep SwiftUI List drawing inside this flex slot — viewport
        // measurement made the Host paint over the header above.
        overflow: "hidden",
      }}
    >
      {showEmptyCard ? (
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 28,
          }}
        >
          <EmptyChatsCard />
        </View>
      ) : null}
      <Host style={{ flex: 1, backgroundColor: "transparent" }}>
        <List
          modifiers={[
            listStyle("plain"),
            scrollContentBackground("hidden"),
            scrollEdgeEffectStyle("soft"),
            listRowSpacing(0),
          ]}
        >
          {showEmptyCard ? null : (
          <Section>
            {selectionError ? (
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
            {chatsError && chats.length > 0 ? (
              <Button
                label={`${chatsError} Tap to retry.`}
                onPress={() => void reloadChats()}
                modifiers={[buttonStyle("plain"), ...rowChrome]}
              />
            ) : null}

            {chats.length === 0 ? (
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
                data={chats}
                keyExtractor={(chat) => chat.id}
                estimatedItemSize={64}
              >
                {({ item: chat }) => (
                  <RecentChatRow
                    chat={chat}
                    mutedColor={mutedColor}
                    rowBackground={rowBackground}
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

            {hasMoreChats ? (
              <Button
                label={chatsLoading ? "Loading…" : "Load more"}
                onPress={() => void loadMoreChats()}
                modifiers={[buttonStyle("plain"), ...rowChrome]}
              />
            ) : null}
          </Section>
          )}
          {showProjects ? (
            <Section title="Projects">
              <List.ForEach
                data={orderedProjects}
                keyExtractor={(project) => project.id}
                estimatedItemSize={52}
              >
                {({ item: project }) => (
                  <ProjectRow
                    project={project}
                    mutedColor={mutedColor}
                    rowBackground={rowBackground}
                  />
                )}
              </List.ForEach>
            </Section>
          ) : null}
          {bottomInset > 0 ? (
            <Section>
              <HStack
                modifiers={[
                  frame({ height: bottomInset, maxWidth: 9999 }),
                  listRowBackground(clearRow),
                  listRowInsets({
                    top: 0,
                    bottom: 0,
                    leading: 0,
                    trailing: 0,
                  }),
                ]}
              />
            </Section>
          ) : null}
        </List>
      </Host>
    </View>
  );
}

function ProjectRow({
  project,
  mutedColor,
  rowBackground,
}: {
  readonly project: ProjectDto;
  readonly mutedColor: string;
  readonly rowBackground: string;
}) {
  return (
    <Button
      onPress={() =>
        router.push(`/projects/${encodeURIComponent(project.id)}`)
      }
      modifiers={[
        buttonStyle("plain"),
        listRowBackground(rowBackground),
        listRowInsets({ top: 10, bottom: 10, leading: 16, trailing: 16 }),
      ]}
    >
      <HStack
        spacing={12}
        alignment="center"
        modifiers={[padding({ vertical: 2 })]}
      >
        <Image
          systemName="folder.fill"
          size={14}
          modifiers={[
            frame({ width: PRESENCE_SLOT, height: PRESENCE_SLOT }),
            tint(mutedColor),
          ]}
        />
        <SwiftText modifiers={[lineLimit(1), font({ size: 17 })]}>
          {project.name}
        </SwiftText>
        <Spacer />
      </HStack>
    </Button>
  );
}

function RecentChatRow({
  chat,
  mutedColor,
  rowBackground,
  projectName,
  onOpen,
  actions,
}: {
  readonly chat: ChatListItem;
  readonly mutedColor: string;
  readonly rowBackground: string;
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
  // Stay in SwiftUI. A React Native host (and a Reanimated pulse inside it)
  // remeasures the row every frame, so after popping a thread the list goes
  // sluggish and stops taking taps.
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
            <SwiftText
              modifiers={[
                lineLimit(1),
                font({ size: 12 }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
              ]}
            >
              {projectName}
            </SwiftText>
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
        listRowBackground(rowBackground),
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
