import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  Button,
  Host,
  HStack,
  Image,
  List,
  Section,
  Spacer,
  Text as SwiftText,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
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

import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import {
  fetchCustomAgents,
  type CustomAgentDto,
} from "@/src/custom-agents-client";
import type { HistoryChatActionHandlers } from "@/components/home/history-list";
import { PEARL_IDENTITY_ACCENT } from "@/components/thread-identity-menu";

/** Fixed leading slot so titles stay aligned with or without a presence mark. */
const PRESENCE_SLOT = 14;

export type { HistoryChatActionHandlers } from "@/components/home/history-list";

/**
 * iOS home: inset-grouped List — Agents, then a History / Workspaces
 * button group.
 */
export function HistoryListIOS({
  onOpenChat,
  bottomInset = 0,
  onCreateAgent,
}: {
  readonly onOpenChat: () => void;
  readonly actions?: HistoryChatActionHandlers;
  readonly bottomInset?: number;
  /** Opens the new-agent composer from the empty Agents row. */
  readonly onCreateAgent?: () => void;
}) {
  const { isAnonymous } = useAuth();
  const { chats, newChat, selectChat } = useChats();
  const pageBackground = useCSSVariable("--color-background") as
    | string
    | undefined;
  const backgroundColor = pageBackground ?? "#FFFFFF";
  const clearRow = "#00000000";
  const mutedForeground = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const mutedColor = mutedForeground ?? "#8E8E93";
  const rowChrome = [
    listRowInsets({ top: 10, bottom: 10, leading: 16, trailing: 16 }),
  ];

  const [agents, setAgents] = useState<readonly CustomAgentDto[] | null>(null);
  const orderedAgents = useMemo(
    () =>
      [...(agents ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [agents],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
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

  const lastPearlChat = chats[0] ?? null;

  const openPearl = useCallback(() => {
    if (lastPearlChat) {
      openChat(lastPearlChat.id);
      return;
    }
    newChat();
    onOpenChat();
  }, [lastPearlChat, newChat, onOpenChat, openChat]);

  const startNewPearlChat = useCallback(() => {
    if (isAnonymous && lastPearlChat) {
      openChat(lastPearlChat.id);
      return;
    }
    newChat();
    onOpenChat();
  }, [isAnonymous, lastPearlChat, newChat, onOpenChat, openChat]);

  const showAgents = agents !== null;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor,
        overflow: "hidden",
      }}
    >
      <Host style={{ flex: 1, backgroundColor }}>
        <List
          modifiers={[
            listStyle("insetGrouped"),
            scrollContentBackground("hidden"),
            scrollEdgeEffectStyle("soft"),
          ]}
        >
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
            <PearlAgentRow
              lastTitle={lastPearlChat?.title ?? null}
              mutedColor={mutedColor}
              onOpen={openPearl}
              onNewChat={startNewPearlChat}
            />
            {showAgents && orderedAgents.length === 0 && onCreateAgent ? (
              <Button
                label="New Agent"
                systemImage="person.crop.circle.badge.plus"
                onPress={onCreateAgent}
                modifiers={[buttonStyle("plain"), ...rowChrome]}
              />
            ) : null}
            {showAgents && orderedAgents.length > 0 ? (
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
            ) : null}
          </Section>
          <Section>
            <Button
              onPress={() => router.push("/history")}
              modifiers={[
                buttonStyle("plain"),
                listRowInsets({ top: 10, bottom: 10, leading: 16, trailing: 16 }),
                accessibilityLabel("History"),
              ]}
            >
              <HStack
                spacing={12}
                alignment="center"
                modifiers={[padding({ vertical: 2 })]}
              >
                <Image
                  systemName="clock"
                  size={14}
                  modifiers={[
                    frame({ width: PRESENCE_SLOT, height: PRESENCE_SLOT }),
                    tint(mutedColor),
                  ]}
                />
                <SwiftText modifiers={[lineLimit(1), font({ size: 17 })]}>
                  History
                </SwiftText>
                <Spacer />
                <Image
                  systemName="chevron.right"
                  size={13}
                  modifiers={[tint(mutedColor), opacity(0.55)]}
                />
              </HStack>
            </Button>
            <Button
              onPress={() => router.push("/workspaces")}
              modifiers={[
                buttonStyle("plain"),
                listRowInsets({ top: 10, bottom: 10, leading: 16, trailing: 16 }),
                accessibilityLabel("Workspaces"),
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
                  Workspaces
                </SwiftText>
                <Spacer />
                <Image
                  systemName="chevron.right"
                  size={13}
                  modifiers={[tint(mutedColor), opacity(0.55)]}
                />
              </HStack>
            </Button>
          </Section>
          {bottomInset > 0 ? (
            <Section>
              <HStack
                modifiers={[
                  frame({ height: bottomInset }),
                  listRowBackground(clearRow),
                  listRowInsets({
                    top: 0,
                    bottom: 0,
                    leading: 0,
                    trailing: 0,
                  }),
                ]}
              >
                <SwiftText> </SwiftText>
              </HStack>
            </Section>
          ) : null}
        </List>
      </Host>
    </View>
  );
}

function PearlAgentRow({
  lastTitle,
  mutedColor,
  onOpen,
  onNewChat,
}: {
  readonly lastTitle: string | null;
  readonly mutedColor: string;
  readonly onOpen: () => void;
  readonly onNewChat: () => void;
}) {
  return (
    <HStack
      spacing={8}
      alignment="center"
      modifiers={[
        listRowInsets({ top: 10, bottom: 10, leading: 16, trailing: 12 }),
        padding({ vertical: 2 }),
      ]}
    >
      <Button
        onPress={onOpen}
        modifiers={[
          buttonStyle("plain"),
          frame({ maxWidth: 9999, alignment: "leading" }),
          accessibilityLabel(
            lastTitle ? `Pearl, ${lastTitle}` : "Pearl",
          ),
        ]}
      >
        <HStack spacing={12} alignment="center">
          <Image
            systemName="circle.fill"
            size={14}
            modifiers={[
              frame({ width: PRESENCE_SLOT, height: PRESENCE_SLOT }),
              tint(PEARL_IDENTITY_ACCENT),
            ]}
          />
          <VStack spacing={2} alignment="leading">
            <SwiftText modifiers={[lineLimit(1), font({ size: 17 })]}>
              Pearl
            </SwiftText>
            {lastTitle ? (
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
                {lastTitle}
              </SwiftText>
            ) : null}
          </VStack>
        </HStack>
      </Button>
      <Button
        onPress={onNewChat}
        modifiers={[
          buttonStyle("plain"),
          accessibilityLabel("New Pearl chat"),
        ]}
      >
        <Image
          systemName="square.and.pencil"
          size={17}
          modifiers={[tint(mutedColor)]}
        />
      </Button>
    </HStack>
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

