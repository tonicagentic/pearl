import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { PlusIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import {
  AgentMark,
  agentListSubtitle,
} from "@/components/custom-agents/agent-mark";
import { CreateAgentModal } from "@/components/home/create-agent-modal";
import { EmptyAgentsState } from "@/components/home/empty-agents-state";
import { AgentsListIOS } from "@/components/home/agents-list";
import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { Text as AppText } from "@/components/ui/text";
import { useAuth } from "@/src/auth";
import { useActiveChat } from "@/src/chat-context";
import {
  deleteCustomAgentRequest,
  fetchCustomAgents,
  type CustomAgentDto,
} from "@/src/custom-agents-client";
import {
  DEFAULT_AGENT_MARK_ACCENT,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
} from "../../../lib/custom-agents/mark";

const AGENT_MARK_SIZE = 40;

/** Drawer → Delegate: custom agents list. */
export function AgentsScreen() {
  const { billingReady, isAnonymous } = useAuth();
  const { selectChat } = useActiveChat();
  const [createOpen, setCreateOpen] = useState(false);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  const openAgentChat = useCallback(() => {
    router.push("/agents/chat", { withAnchor: true });
  }, []);

  const openCreate = useCallback(() => {
    if (!billingReady || isAnonymous) return;
    setCreateOpen(true);
  }, [billingReady, isAnonymous]);

  const onCreated = useCallback(
    (agent: CustomAgentDto) => {
      setCreateOpen(false);
      void selectChat(agent.chatId).then((ok) => {
        if (ok) openAgentChat();
      });
    },
    [openAgentChat, selectChat],
  );

  return (
    <ScreenChrome
      title="Delegate"
      leading="drawer"
      wrapBody={false}
      actions={[
        {
          label: "New agent",
          systemImage: "plus",
          icon: PlusIcon,
          onPress: openCreate,
          separateBackground: true,
          hidden: isAnonymous || !billingReady,
        },
      ]}
    >
      <View style={{ flex: 1, backgroundColor }}>
        {Platform.OS === "ios" ? (
          <AgentsListIOS onOpenChat={openAgentChat} />
        ) : (
          <AgentsListAndroid onOpenChat={openAgentChat} />
        )}
        <CreateAgentModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={onCreated}
        />
      </View>
    </ScreenChrome>
  );
}

function AgentsListAndroid({
  onOpenChat,
}: {
  readonly onOpenChat: () => void;
}) {
  const { selectChat } = useActiveChat();
  const [agents, setAgents] = useState<readonly CustomAgentDto[] | null>(null);
  const groupedAgents = useMemo(() => {
    const map = new Map<
      string,
      { readonly name: string; readonly agents: CustomAgentDto[] }
    >();
    for (const agent of agents ?? []) {
      const key = agent.projectId || "unknown";
      const bucket = map.get(key);
      if (bucket) {
        bucket.agents.push(agent);
      } else {
        map.set(key, {
          name: agent.projectName ?? "Project",
          agents: [agent],
        });
      }
    }
    return [...map.entries()]
      .map(([id, group]) => ({
        projectId: id,
        name: group.name,
        agents: group.agents.sort((a, b) => {
          if (a.role !== b.role) {
            return a.role === "manager" ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [agents]);
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

  const deleteAgent = (agent: CustomAgentDto) => {
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
  };

  const agentsEmpty = agents !== null && groupedAgents.length === 0;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: pageBackground }}
      edges={["left", "right", "bottom"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-0"
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 32,
          ...(agentsEmpty
            ? {
                justifyContent: "center" as const,
                alignItems: "center" as const,
              }
            : null),
        }}
      >
        {agentsEmpty ? (
          <EmptyAgentsState />
        ) : (
          <View className="mb-8 gap-5">
            {groupedAgents.map((group) => (
              <View key={group.projectId}>
                <AppText
                  variant="caption"
                  weight="medium"
                  className="mb-1 px-5 uppercase tracking-wide text-muted-foreground"
                >
                  {group.name}
                </AppText>
                {group.agents.map((agent) => {
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
                      onLongPress={() => {
                        if (agent.role === "manager") {
                          Alert.alert(
                            "Project manager",
                            "Delete the project to remove its manager.",
                          );
                          return;
                        }
                        deleteAgent(agent);
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
                          {agent.role === "manager" ? " · Manager" : ""}
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
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
