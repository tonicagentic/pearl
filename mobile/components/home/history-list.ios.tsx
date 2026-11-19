import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  Button,
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
  buttonStyle,
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
  multilineTextAlignment,
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
/** Squircle size for the pinned Pearl tile. */
const PINNED_MARK_SIZE = 72;
/** Shared horizontal inset for agent/nav rows. */
const ROW_LEADING = 20;

export type { HistoryChatActionHandlers } from "@/components/home/history-list";

/**
 * iOS home: plain List — pinned Pearl, then custom agents.
 * Styled after Grok bots (no separators, airy rows).
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
  const { chats, newChat, selectChat } = useChats();
  const pageBackground = useCSSVariable("--color-background") as
    | string
    | undefined;
  const backgroundColor = pageBackground ?? "#FFFFFF";
  const clearRow = "#00000000";
  const rowChrome = [
    listRowInsets({
      top: 14,
      bottom: 14,
      leading: ROW_LEADING,
      trailing: ROW_LEADING,
    }),
    listRowBackground(backgroundColor),
    listRowSeparator("hidden"),
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
            listStyle("plain"),
            scrollContentBackground("hidden"),
            scrollEdgeEffectStyle("soft"),
            listRowSpacing(10),
          ]}
        >
          <Section>
            <PearlPinnedRow
              rowBackground={backgroundColor}
              onOpenPearl={openPearl}
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
      <View
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
          motion="burst"
          eyeMotion="idle"
        />
      </View>
    </RNHostView>
  );
}

/** Centered pinned Pearl. */
function PearlPinnedRow({
  rowBackground,
  onOpenPearl,
}: {
  readonly rowBackground: string;
  readonly onOpenPearl: () => void;
}) {
  const pearlMetrics = pearlMarkMetrics(
    PINNED_MARK_SIZE,
    PEARL_MARK_HEIGHT_RATIO,
  );
  return (
    <HStack
      spacing={0}
      alignment="bottom"
      modifiers={[
        listRowInsets({
          top: 4,
          bottom: 22,
          leading: ROW_LEADING,
          trailing: ROW_LEADING,
        }),
        listRowBackground(rowBackground),
        listRowSeparator("hidden"),
      ]}
    >
      <Spacer />
      <VStack
        spacing={6}
        alignment="center"
        modifiers={[
          frame({ width: pearlMetrics.width + 8 }),
          onTapGesture(onOpenPearl),
          accessibilityLabel("Pearl"),
          contentShape(shapes.rectangle()),
        ]}
      >
        <AgentListMark
          accent={PEARL_IDENTITY_ACCENT}
          size={PINNED_MARK_SIZE}
          markShape="oval"
          markTalk="hinge"
          markBrows={DEFAULT_AGENT_MARK_BROWS}
          markGaze={DEFAULT_AGENT_MARK_GAZE}
          heightRatio={PEARL_MARK_HEIGHT_RATIO}
        />
        <SwiftText
          modifiers={[
            lineLimit(1),
            font({ size: 12, weight: "regular" }),
            multilineTextAlignment("center"),
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

