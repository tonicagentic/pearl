import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  Button,
  Host,
  HStack,
  Image,
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
  opacity,
  scrollContentBackground,
  scrollEdgeEffectStyle,
  shapes,
  tint,
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
  DEFAULT_AGENT_MARK_HEIGHT_RATIO,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
  PEARL_MARK_HEIGHT_RATIO,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "../../../lib/custom-agents/mark";

/** Fixed leading slot so NavRow icons stay aligned. */
const PRESENCE_SLOT = 14;
/** Circular eye-mark size for Agents list rows (Grok bots). */
const AGENT_MARK_SIZE = 40;
/** Squircle size for the pinned Pearl tile. */
const PINNED_MARK_SIZE = 72;
/** Shared horizontal inset for agent/nav rows. */
const ROW_LEADING = 20;

export type { HistoryChatActionHandlers } from "@/components/home/history-list";

/**
 * iOS home: plain List — pinned Pearl, custom agents, then History /
 * Workspaces. Styled after Grok bots (no separators, airy rows).
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
  const mutedForeground = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const mutedColor = mutedForeground ?? "#8E8E93";
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
              onOpen={openPearl}
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
          <Section>
            <NavRow
              label="History"
              systemImage="clock"
              mutedColor={mutedColor}
              rowBackground={backgroundColor}
              onPress={() => router.push("/history")}
            />
            <NavRow
              label="Workspaces"
              systemImage="folder.fill"
              mutedColor={mutedColor}
              rowBackground={backgroundColor}
              onPress={() => router.push("/workspaces")}
            />
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
  heightRatio = DEFAULT_AGENT_MARK_HEIGHT_RATIO,
}: {
  readonly accent: string;
  readonly size?: number;
  readonly markShape?: AgentMarkShape;
  readonly markTalk?: AgentMarkTalk;
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
          heightRatio={heightRatio}
          motion="burst"
        />
      </View>
    </RNHostView>
  );
}

/** Grok-style pinned Pearl: large squircle + label. */
function PearlPinnedRow({
  rowBackground,
  onOpen,
}: {
  readonly rowBackground: string;
  readonly onOpen: () => void;
}) {
  return (
    <HStack
      spacing={8}
      alignment="top"
      modifiers={[
        listRowInsets({
          top: 4,
          bottom: 22,
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
      <VStack
        spacing={6}
        alignment="center"
        modifiers={[
          frame({
            width:
              pearlMarkMetrics(PINNED_MARK_SIZE, PEARL_MARK_HEIGHT_RATIO)
                .width + 8,
          }),
        ]}
      >
        <AgentListMark
          accent={PEARL_IDENTITY_ACCENT}
          size={PINNED_MARK_SIZE}
          markShape="oval"
          markTalk="hinge"
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

function NavRow({
  label,
  systemImage,
  mutedColor,
  rowBackground,
  onPress,
}: {
  readonly label: string;
  readonly systemImage: "clock" | "folder.fill";
  readonly mutedColor: string;
  readonly rowBackground: string;
  readonly onPress: () => void;
}) {
  return (
    <HStack
      spacing={12}
      alignment="center"
      modifiers={[
        listRowInsets({
          top: 12,
          bottom: 12,
          leading: ROW_LEADING,
          trailing: ROW_LEADING,
        }),
        listRowBackground(rowBackground),
        listRowSeparator("hidden"),
        ...FULL_ROW_HIT,
        onTapGesture(onPress),
        accessibilityLabel(label),
      ]}
    >
      <Image
        systemName={systemImage}
        size={14}
        modifiers={[
          frame({ width: PRESENCE_SLOT, height: PRESENCE_SLOT }),
          tint(mutedColor),
        ]}
      />
      <SwiftText
        modifiers={[lineLimit(1), font({ size: 16, weight: "regular" })]}
      >
        {label}
      </SwiftText>
      <Spacer />
      <Image
        systemName="chevron.right"
        size={13}
        modifiers={[tint(mutedColor), opacity(0.55)]}
      />
    </HStack>
  );
}
