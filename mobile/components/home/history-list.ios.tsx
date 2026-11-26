import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  Button,
  Host,
  HStack,
  List,
  RNHostView,
  Section,
  Spacer,
  SwipeActions,
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
import {
  AgentMark,
  agentListSubtitle,
  pearlMarkMetrics,
} from "@/components/custom-agents/agent-mark";
import { EmptyAgentsState } from "@/components/home/empty-agents-state";
import type { HistoryChatActionHandlers } from "@/components/home/history-list";
import type { HomeTab } from "@/components/home/home-tab";
import { PEARL_IDENTITY_ACCENT } from "@/components/thread-identity-menu";
import { Text as AppText } from "@/components/ui/text";
import { useActiveChat } from "@/src/chat-context";
import {
  deleteCustomAgentRequest,
  fetchCustomAgents,
  type CustomAgentDto,
} from "@/src/custom-agents-client";
import { usePearlScreenBackground } from "@/src/navigation-theme";
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
/** Pearl tab hero mark. */
const PEARL_HERO_SIZE = 88;
/** Shared horizontal inset for agent/nav rows. */
const ROW_LEADING = 20;

export type { HistoryChatActionHandlers } from "@/components/home/history-list";

/**
 * iOS home body: Pearl compose surface, or Agents list.
 */
export function HistoryListIOS({
  tab,
  onOpenChat,
  bottomInset = 0,
}: {
  readonly tab: HomeTab;
  readonly onOpenChat: () => void;
  readonly actions?: HistoryChatActionHandlers;
  readonly bottomInset?: number;
}) {
  const { newChat, selectChat } = useActiveChat();
  const backgroundColor = usePearlScreenBackground();
  const clearRow = backgroundColor;

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
    newChat();
    onOpenChat();
  }, [newChat, onOpenChat]);

  const deleteAgent = useCallback((agent: CustomAgentDto) => {
    Alert.alert(
      "Delete agent?",
      `Remove ${agent.name}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setAgents((current) =>
              (current ?? []).filter((row) => row.id !== agent.id),
            );
            void deleteCustomAgentRequest(agent.id).catch(() => {
              Alert.alert(
                "Could not delete agent",
                "Check your connection and try again.",
              );
              void fetchCustomAgents()
                .then(setAgents)
                .catch(() => undefined);
            });
          },
        },
      ],
    );
  }, []);

  if (tab === "pearl") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor,
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: bottomInset,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pearl"
          className="items-center active:opacity-80"
          style={{ gap: 10 }}
          onPress={openPearl}
        >
          <AgentMark
            accent={PEARL_IDENTITY_ACCENT}
            size={PEARL_HERO_SIZE}
            markShape="oval"
            markTalk="hinge"
            markBrows={DEFAULT_AGENT_MARK_BROWS}
            markGaze={DEFAULT_AGENT_MARK_GAZE}
            heightRatio={PEARL_MARK_HEIGHT_RATIO}
            motion="idle"
            eyeMotion="idle"
          />
          <AppText variant="label" weight="semibold">
            Pearl
          </AppText>
        </Pressable>
      </View>
    );
  }

  const agentsEmpty = agents !== null && orderedAgents.length === 0;

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
            {agents !== null && !agentsEmpty ? (
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
                    onDelete={() => deleteAgent(agent)}
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
      {agentsEmpty ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: bottomInset,
          }}
        >
          <EmptyAgentsState />
        </View>
      ) : null}
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

function AgentRow({
  agent,
  rowBackground,
  onOpen,
  onDelete,
}: {
  readonly agent: CustomAgentDto;
  readonly rowBackground: string;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
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
    <SwipeActions
      modifiers={[
        listRowInsets({
          top: 10,
          bottom: 10,
          leading: ROW_LEADING,
          trailing: ROW_LEADING,
        }),
        listRowBackground(rowBackground),
        listRowSeparator("hidden"),
      ]}
    >
      <HStack
        spacing={12}
        alignment="center"
        modifiers={[
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
      <SwipeActions.Actions edge="trailing" allowsFullSwipe>
        <Button
          label="Delete"
          systemImage="trash"
          role="destructive"
          onPress={onDelete}
        />
      </SwipeActions.Actions>
    </SwipeActions>
  );
}
