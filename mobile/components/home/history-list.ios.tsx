import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  Host,
  HStack,
  List,
  RNHostView,
  Section,
  Spacer,
  Text as SwiftText,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  contentShape,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  listRowSpacing,
  listStyle,
  onTapGesture,
  scrollContentBackground,
  scrollEdgeEffectStyle,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { useCSSVariable } from "uniwind";

import {
  AgentMark,
  agentListSubtitle,
  pearlMarkMetrics,
} from "@/components/custom-agents/agent-mark";
import type { HistoryChatActionHandlers } from "@/components/home/history-list";
import { PEARL_IDENTITY_ACCENT } from "@/components/thread-identity-menu";
import { useChats } from "@/src/chat-context";
import {
  fetchCustomAgents,
  type CustomAgentDto,
} from "@/src/custom-agents-client";
import {
  DEFAULT_AGENT_MARK_ACCENT,
  DEFAULT_AGENT_MARK_BROWS,
  DEFAULT_AGENT_MARK_GAZE,
  DEFAULT_AGENT_MARK_HEIGHT_RATIO,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
  PEARL_MARK_HEIGHT_RATIO,
  type AgentMarkBrows,
  type AgentMarkGaze,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "../../../lib/custom-agents/mark";

/** Circular eye-mark size for Agents list rows (Grok bots). */
const AGENT_MARK_SIZE = 40;
/** Shared horizontal inset for agent/nav rows. */
const ROW_LEADING = 20;

export type { HistoryChatActionHandlers } from "@/components/home/history-list";

/**
 * iOS home: plain List — Pearl first (same row style as agents), then custom agents.
 */
export function HistoryListIOS({
  onOpenChat,
  bottomInset = 0,
}: {
  readonly onOpenChat: () => void;
  readonly actions?: HistoryChatActionHandlers;
  readonly bottomInset?: number;
}) {
  const { newChat, selectChat } = useChats();
  const pageBackground = useCSSVariable("--color-background") as
    | string
    | undefined;
  const backgroundColor = pageBackground ?? "#FFFFFF";
  const clearRow = "#00000000";

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

  const openPearl = useCallback(() => {
    // Fresh Pearl thread — don't reopen a custom-agent chat that happens to be first.
    newChat();
    onOpenChat();
  }, [newChat, onOpenChat]);

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
            listStyle("plain"),
            scrollContentBackground("hidden"),
            scrollEdgeEffectStyle("soft"),
            listRowSpacing(10),
          ]}
        >
          <Section>
            <PearlRow
              rowBackground={backgroundColor}
              onOpen={openPearl}
            />
            {agents !== null ? (
              <List.ForEach
                data={orderedAgents}
                keyExtractor={(agent) => agent.id}
                estimatedItemSize={68}
                recycling={false}
              >
                {({ item: agent }) => (
                  <AgentRow
                    agent={agent}
                    rowBackground={backgroundColor}
                    onOpen={() => openChat(agent.chatId)}
                  />
                )}
              </List.ForEach>
            ) : null}
          </Section>
          {bottomInset > 0 ? (
            <Section>
              <HStack
                modifiers={[
                  frame({ height: bottomInset }),
                  listRowBackground(clearRow),
                  listRowSeparator("hidden"),
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

/** Full-row hit target: plain Buttons only hit visible labels unless shaped. */
const FULL_ROW_HIT = [
  contentShape(shapes.rectangle()),
  frame({ maxWidth: 9999, alignment: "leading" as const }),
];

function AgentListMark({
  accent,
  size = AGENT_MARK_SIZE,
  markShape = DEFAULT_AGENT_MARK_SHAPE,
  markTalk = DEFAULT_AGENT_MARK_TALK,
  markBrows,
  markGaze,
  heightRatio = DEFAULT_AGENT_MARK_HEIGHT_RATIO,
}: {
  readonly accent: string;
  readonly size?: number;
  readonly markShape?: AgentMarkShape;
  readonly markTalk?: AgentMarkTalk;
  readonly markBrows?: AgentMarkBrows;
  readonly markGaze?: AgentMarkGaze;
  readonly heightRatio?: number;
}) {
  const metrics = pearlMarkMetrics(size, heightRatio);
  return (
    <RNHostView matchContents>
      {/* Let the SwiftUI row own taps — burst Pressable would steal them. */}
      <View
        pointerEvents="none"
        style={{ width: metrics.width, height: metrics.layoutHeight }}
      >
        <AgentMark
          accent={accent}
          size={size}
          markShape={markShape}
          markTalk={markTalk}
          markBrows={markBrows}
          markGaze={markGaze}
          heightRatio={heightRatio}
          motion="off"
          eyeMotion="idle"
        />
      </View>
    </RNHostView>
  );
}

/** Pearl as a normal agent-style list row (top of the list). */
function PearlRow({
  rowBackground,
  onOpen,
}: {
  readonly rowBackground: string;
  readonly onOpen: () => void;
}) {
  return (
    <HStack
      spacing={12}
      alignment="center"
      modifiers={[
        listRowInsets({
          top: 10,
          bottom: 10,
          leading: ROW_LEADING,
          trailing: ROW_LEADING,
        }),
        listRowBackground(rowBackground),
        listRowSeparator("hidden"),
        ...FULL_ROW_HIT,
        onTapGesture(onOpen),
        accessibilityLabel("Pearl"),
      ]}
    >
      <AgentListMark
        accent={PEARL_IDENTITY_ACCENT}
        markShape="oval"
        markTalk="hinge"
        markBrows={DEFAULT_AGENT_MARK_BROWS}
        markGaze={DEFAULT_AGENT_MARK_GAZE}
        heightRatio={PEARL_MARK_HEIGHT_RATIO}
      />
      <VStack spacing={1} alignment="leading">
        <SwiftText
          modifiers={[
            lineLimit(1),
            font({ size: 16, weight: "semibold" }),
          ]}
        >
          Pearl
        </SwiftText>
      </VStack>
      <Spacer />
    </HStack>
  );
}

function AgentRow({
  agent,
  rowBackground,
  onOpen,
}: {
  readonly agent: CustomAgentDto;
  readonly rowBackground: string;
  readonly onOpen: () => void;
}) {
  const accent = agent.accent || DEFAULT_AGENT_MARK_ACCENT;
  const markShape = agent.markShape ?? DEFAULT_AGENT_MARK_SHAPE;
  const markTalk = agent.markTalk ?? DEFAULT_AGENT_MARK_TALK;
  const markBrows = agent.markBrows ?? DEFAULT_AGENT_MARK_BROWS;
  const markGaze = agent.markGaze ?? DEFAULT_AGENT_MARK_GAZE;
  const subtitle = agentListSubtitle({
    name: agent.name,
    chatTitle: agent.chatTitle,
    instructions: agent.instructions,
  });
  return (
    <HStack
      spacing={12}
      alignment="center"
      modifiers={[
        listRowInsets({
          top: 10,
          bottom: 10,
          leading: ROW_LEADING,
          trailing: ROW_LEADING,
        }),
        listRowBackground(rowBackground),
        listRowSeparator("hidden"),
        ...FULL_ROW_HIT,
        onTapGesture(onOpen),
        accessibilityLabel(
          subtitle ? `${agent.name}, ${subtitle}` : agent.name,
        ),
      ]}
    >
      <AgentListMark
        accent={accent}
        markShape={markShape}
        markTalk={markTalk}
        markBrows={markBrows}
        markGaze={markGaze}
      />
      <VStack spacing={1} alignment="leading">
        <SwiftText
          modifiers={[
            lineLimit(1),
            font({ size: 16, weight: "semibold" }),
          ]}
        >
          {agent.name}
        </SwiftText>
        {subtitle ? (
          <SwiftText
            modifiers={[
              lineLimit(1),
              font({ size: 14, weight: "regular" }),
              foregroundStyle({
                type: "hierarchical",
                style: "secondary",
              }),
            ]}
          >
            {subtitle}
          </SwiftText>
        ) : null}
      </VStack>
      <Spacer />
    </HStack>
  );
}

