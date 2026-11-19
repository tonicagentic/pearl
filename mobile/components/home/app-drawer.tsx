import { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import {
  AgentMark,
  agentListSubtitle,
} from "@/components/custom-agents/agent-mark";
import {
  HistoryListIOS,
  type HistoryChatActionHandlers,
} from "@/components/home/history-list";
import type { HomeTab } from "@/components/home/home-tab";
import { PEARL_IDENTITY_ACCENT } from "@/components/thread-identity-menu";
import { Text as AppText } from "@/components/ui/text";
import { useChats } from "@/src/chat-context";
import {
  fetchCustomAgents,
  type CustomAgentDto,
} from "@/src/custom-agents-client";
import {
  DEFAULT_AGENT_MARK_ACCENT,
  DEFAULT_AGENT_MARK_BROWS,
  DEFAULT_AGENT_MARK_GAZE,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
  PEARL_MARK_HEIGHT_RATIO,
} from "../../../lib/custom-agents/mark";

const AGENT_MARK_SIZE = 40;
const PEARL_HERO_SIZE = 88;

export type { HistoryChatActionHandlers };

/**
 * Home body: Pearl compose surface, or Agents list.
 */
export function HistoryScreen({
  tab,
  onOpenChat,
  visible = true,
  bottomInset = 0,
}: {
  readonly tab: HomeTab;
  /** Called after selecting an existing chat (caller should push `/chat`). */
  onOpenChat?: () => void;
  visible?: boolean;
  readonly bottomInset?: number;
}) {
  const openChatRoute = () => {
    if (onOpenChat) onOpenChat();
    else router.push("/chat");
  };

  if (Platform.OS === "ios") {
    return (
      <View style={{ flex: 1 }} accessibilityElementsHidden={!visible}>
        <HistoryListIOS
          tab={tab}
          onOpenChat={openChatRoute}
          bottomInset={bottomInset}
        />
      </View>
    );
  }

  return (
    <HistoryListAndroid
      tab={tab}
      visible={visible}
      onOpenChat={openChatRoute}
      bottomInset={bottomInset}
    />
  );
}

function HistoryListAndroid({
  tab,
  visible,
  onOpenChat,
  bottomInset = 0,
}: {
  readonly tab: HomeTab;
  readonly visible: boolean;
  readonly onOpenChat: () => void;
  readonly bottomInset?: number;
}) {
  const { newChat, selectChat } = useChats();
  const [agents, setAgents] = useState<readonly CustomAgentDto[] | null>(null);
  const orderedAgents = useMemo(
    () =>
      [...(agents ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [agents],
  );
  const pageBackground = useCSSVariable("--color-background") as
    | string
    | undefined;

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

  const openPearl = () => {
    newChat();
    onOpenChat();
  };

  if (tab === "pearl") {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: pageBackground }}
        edges={["left", "right", "bottom"]}
        accessibilityElementsHidden={!visible}
      >
        <View
          style={{
            flex: 1,
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: pageBackground }}
      edges={["left", "right", "bottom"]}
      accessibilityElementsHidden={!visible}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-0"
        contentContainerStyle={{ paddingBottom: 32 + bottomInset }}
      >
        <View className="mb-8">
          {orderedAgents.map((agent) => {
            const subtitle = agentListSubtitle({
              name: agent.name,
              chatTitle: agent.chatTitle,
              instructions: agent.instructions,
            });
            return (
              <Pressable
                key={agent.id}
                accessibilityRole="button"
                accessibilityLabel={
                  subtitle ? `${agent.name}, ${subtitle}` : agent.name
                }
                className="min-h-[60px] w-full flex-row items-center gap-3 px-5 py-2.5"
                onPress={() => {
                  void selectChat(agent.chatId).then((selected) => {
                    if (selected) onOpenChat();
                  });
                }}
              >
                <AgentMark
                  accent={agent.accent || DEFAULT_AGENT_MARK_ACCENT}
                  size={AGENT_MARK_SIZE}
                  markShape={agent.markShape ?? DEFAULT_AGENT_MARK_SHAPE}
                  markTalk={agent.markTalk ?? DEFAULT_AGENT_MARK_TALK}
                  markBrows={agent.markBrows}
                  markGaze={agent.markGaze}
                  motion="off"
                  eyeMotion="idle"
                />
                <View className="min-w-0 flex-1" style={{ gap: 1 }}>
                  <AppText
                    variant="label"
                    weight="semibold"
                    numberOfLines={1}
                  >
                    {agent.name}
                  </AppText>
                  {subtitle ? (
                    <AppText
                      variant="secondary"
                      weight="regular"
                      numberOfLines={1}
                    >
                      {subtitle}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
