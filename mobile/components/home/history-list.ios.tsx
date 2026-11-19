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
import {
  fetchCustomAgents,
  type CustomAgentDto,
} from "@/src/custom-agents-client";
import { fetchProjects, type ProjectDto } from "@/src/projects-client";
import type { HistoryChatActionHandlers } from "@/components/home/history-list";

/** Fixed leading slot so titles stay aligned with or without a presence mark. */
const PRESENCE_SLOT = 14;

export type { HistoryChatActionHandlers } from "@/components/home/history-list";

/** Keep Recents short so the Projects group stays on the first screen. */
const RECENT_PREVIEW_COUNT = 6;

/**
 * iOS home: inset-grouped List — Recents, then Projects, then Agents —
 * with swipe delete and context menu actions.
 */
export function HistoryListIOS({
  onOpenChat,
  actions,
  bottomInset = 0,
  onCreateProject,
  onCreateAgent,
}: {
  readonly onOpenChat: () => void;
  readonly actions: HistoryChatActionHandlers;
  readonly bottomInset?: number;
  /** Opens the shared new-project composer from the empty Projects row. */
  readonly onCreateProject?: () => void;
  /** Opens the new-agent composer from the empty Agents row. */
  readonly onCreateAgent?: () => void;
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
  // Spacer rows stay clear so the composer clearance does not paint a card.
  const clearRow = "#00000000";
  const mutedForeground = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const mutedColor = mutedForeground ?? "#8E8E93";
  // Let insetGrouped own row fills; only pin insets for status/empty rows.
  const rowChrome = [
    listRowInsets({ top: 10, bottom: 10, leading: 16, trailing: 16 }),
  ];

  const [projects, setProjects] = useState<readonly ProjectDto[] | null>(null);
  const [agents, setAgents] = useState<readonly CustomAgentDto[] | null>(null);
  const [recentsExpanded, setRecentsExpanded] = useState(false);
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
  const visibleChats = useMemo(() => {
    if (recentsExpanded || chats.length <= RECENT_PREVIEW_COUNT) return chats;
    return chats.slice(0, RECENT_PREVIEW_COUNT);
  }, [chats, recentsExpanded]);
  const canExpandRecents =
    !recentsExpanded && chats.length > RECENT_PREVIEW_COUNT;

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

  // Show the Projects/Agents groups once the fetch settles — empty state
  // included — so they are not mistaken for missing sections.
  const showProjects = projects !== null;
  const showAgents = agents !== null;

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
        // Pearl background shows through the inset-grouped cards; hiding the
        // system list chrome avoids iOS's default grouped gray.
        backgroundColor,
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
      <Host style={{ flex: 1, backgroundColor }}>
        <List
          modifiers={[
            listStyle("insetGrouped"),
            scrollContentBackground("hidden"),
            scrollEdgeEffectStyle("soft"),
          ]}
        >
          {showEmptyCard ? null : (
          <Section title="Recents">
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
                data={visibleChats}
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

            {canExpandRecents ? (
              <Button
                label="Show more"
                onPress={() => setRecentsExpanded(true)}
                modifiers={[buttonStyle("plain"), ...rowChrome]}
              />
            ) : hasMoreChats ? (
              <Button
                label={chatsLoading ? "Loading…" : "Load more"}
                onPress={() => void loadMoreChats()}
                modifiers={[buttonStyle("plain"), ...rowChrome]}
              />
            ) : null}
          </Section>
          )}
          {showProjects ? (
            <Section
              header={
                <HStack alignment="center">
                  <SwiftText
                    modifiers={[
                      font({ size: 13 }),
                      foregroundStyle({
                        type: "hierarchical",
                        style: "secondary",
                      }),
                    ]}
                  >
                    Projects
                  </SwiftText>
                  <Spacer />
                  {onCreateProject ? (
                    <Button
                      onPress={onCreateProject}
                      modifiers={[buttonStyle("plain")]}
                    >
                      <Image
                        systemName="plus"
                        size={14}
                        modifiers={[tint(mutedColor)]}
                      />
                    </Button>
                  ) : null}
                </HStack>
              }
            >
              {orderedProjects.length === 0 ? (
                onCreateProject ? (
                  <Button
                    label="New Project"
                    systemImage="folder.badge.plus"
                    onPress={onCreateProject}
                    modifiers={[buttonStyle("plain"), ...rowChrome]}
                  />
                ) : (
                  <SwiftText
                    modifiers={[
                      foregroundStyle({
                        type: "hierarchical",
                        style: "secondary",
                      }),
                      font({ size: 15 }),
                      ...rowChrome,
                    ]}
                  >
                    No projects yet
                  </SwiftText>
                )
              ) : (
                <List.ForEach
                  data={orderedProjects}
                  keyExtractor={(project) => project.id}
                  estimatedItemSize={52}
                  recycling={false}
                >
                  {({ item: project }) => (
                    <ProjectRow project={project} mutedColor={mutedColor} />
                  )}
                </List.ForEach>
              )}
            </Section>
          ) : null}
          {showAgents ? (
            <Section
              header={
                <HStack alignment="center">
                  <SwiftText
                    modifiers={[
                      font({ size: 13 }),
                      foregroundStyle({
                        type: "hierarchical",
                        style: "secondary",
                      }),
                    ]}
                  >
                    Agents
                  </SwiftText>
                  <Spacer />
                  {onCreateAgent ? (
                    <Button
                      onPress={onCreateAgent}
                      modifiers={[buttonStyle("plain")]}
                    >
                      <Image
                        systemName="plus"
                        size={14}
                        modifiers={[tint(mutedColor)]}
                      />
                    </Button>
                  ) : null}
                </HStack>
              }
            >
              {orderedAgents.length === 0 ? (
                onCreateAgent ? (
                  <Button
                    label="New Agent"
                    systemImage="person.crop.circle.badge.plus"
                    onPress={onCreateAgent}
                    modifiers={[buttonStyle("plain"), ...rowChrome]}
                  />
                ) : (
                  <SwiftText
                    modifiers={[
                      foregroundStyle({
                        type: "hierarchical",
                        style: "secondary",
                      }),
                      font({ size: 15 }),
                      ...rowChrome,
                    ]}
                  >
                    No agents yet
                  </SwiftText>
                )
              ) : (
                <List.ForEach
                  data={orderedAgents}
                  keyExtractor={(agent) => agent.id}
                  estimatedItemSize={52}
                  recycling={false}
                >
                  {({ item: agent }) => (
                    <AgentRow
                      agent={agent}
                      onOpen={() => openChat(agent.chatId)}
                    />
                  )}
                </List.ForEach>
              )}
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

function AgentRow({
  agent,
  onOpen,
}: {
  readonly agent: CustomAgentDto;
  readonly onOpen: () => void;
}) {
  const accent = agent.accent || "#2DD4BF";
  return (
    <Button
      onPress={onOpen}
      modifiers={[
        buttonStyle("plain"),
        listRowInsets({ top: 10, bottom: 10, leading: 16, trailing: 16 }),
      ]}
    >
      <HStack
        spacing={12}
        alignment="center"
        modifiers={[padding({ vertical: 2 })]}
      >
        <Image
          systemName="circle.fill"
          size={14}
          modifiers={[
            frame({ width: PRESENCE_SLOT, height: PRESENCE_SLOT }),
            tint(accent),
          ]}
        />
        <SwiftText modifiers={[lineLimit(1), font({ size: 17 })]}>
          {agent.name}
        </SwiftText>
        <Spacer />
      </HStack>
    </Button>
  );
}

function ProjectRow({
  project,
  mutedColor,
}: {
  readonly project: ProjectDto;
  readonly mutedColor: string;
}) {
  return (
    <Button
      onPress={() =>
        router.push(`/projects/${encodeURIComponent(project.id)}`)
      }
      modifiers={[
        buttonStyle("plain"),
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
