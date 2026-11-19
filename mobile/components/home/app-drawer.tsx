import { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronRightIcon,
  ClockIcon,
  FolderIcon,
  SquarePenIcon,
} from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";
import { Text as AppText } from "@/components/ui/text";
import {
  HistoryListIOS,
  type HistoryChatActionHandlers,
} from "@/components/home/history-list";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import {
  fetchCustomAgents,
  type CustomAgentDto,
} from "@/src/custom-agents-client";
import { PEARL_IDENTITY_ACCENT } from "@/components/thread-identity-menu";

export type { HistoryChatActionHandlers };

/**
 * Home list: Agents plus History / Workspaces.
 * Selecting Pearl or an agent opens `/chat`.
 */
export function HistoryScreen({
  onOpenChat,
  visible = true,
  bottomInset = 0,
  onCreateAgent,
}: {
  /** Called after selecting an existing chat (caller should push `/chat`). */
  onOpenChat?: () => void;
  visible?: boolean;
  readonly bottomInset?: number;
  /** Opens the new-agent composer (empty Agents row). */
  readonly onCreateAgent?: () => void;
}) {
  const openChatRoute = () => {
    if (onOpenChat) onOpenChat();
    else router.push("/chat");
  };

  if (Platform.OS === "ios") {
    return (
      <View style={{ flex: 1 }} accessibilityElementsHidden={!visible}>
        <HistoryListIOS
          onOpenChat={openChatRoute}
          bottomInset={bottomInset}
          onCreateAgent={onCreateAgent}
        />
      </View>
    );
  }

  return (
    <HistoryListAndroid
      visible={visible}
      onOpenChat={openChatRoute}
      bottomInset={bottomInset}
      onCreateAgent={onCreateAgent}
    />
  );
}

function HistoryListAndroid({
  visible,
  onOpenChat,
  bottomInset = 0,
  onCreateAgent,
}: {
  readonly visible: boolean;
  readonly onOpenChat: () => void;
  readonly onCreateAgent?: () => void;
  readonly bottomInset?: number;
}) {
  const { isAnonymous } = useAuth();
  const { chats, newChat, selectChat } = useChats();
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

  const lastPearlChat = chats[0] ?? null;
  const openPearl = () => {
    if (lastPearlChat) {
      void selectChat(lastPearlChat.id).then((selected) => {
        if (selected) onOpenChat();
      });
      return;
    }
    newChat();
    onOpenChat();
  };
  const startNewPearlChat = () => {
    if (isAnonymous && lastPearlChat) {
      void selectChat(lastPearlChat.id).then((selected) => {
        if (selected) onOpenChat();
      });
      return;
    }
    newChat();
    onOpenChat();
  };

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
        <View className="mb-6">
          <View className="mb-1 flex-row items-center justify-between px-3">
            <AppText variant="secondary" weight="medium">
              Agents
            </AppText>
            {onCreateAgent ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New agent"
                className="min-h-8 justify-center px-1"
                onPress={onCreateAgent}
              >
                <AppText variant="secondary" weight="medium">
                  New
                </AppText>
              </Pressable>
            ) : null}
          </View>
          <View className="min-h-12 flex-row items-center">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                lastPearlChat ? `Pearl, ${lastPearlChat.title}` : "Pearl"
              }
              className="min-h-12 min-w-0 flex-1 flex-row items-center gap-3 px-3 py-2"
              onPress={openPearl}
            >
              <View
                className="size-3.5 items-center justify-center rounded-full"
                style={{ backgroundColor: PEARL_IDENTITY_ACCENT }}
              >
                <View className="flex-row gap-0.5">
                  <View className="h-1.5 w-0.5 rounded-full bg-white" />
                  <View className="h-1.5 w-0.5 rounded-full bg-white" />
                </View>
              </View>
              <View className="min-w-0 flex-1">
                <AppText variant="body" weight="medium" numberOfLines={1}>
                  Pearl
                </AppText>
                {lastPearlChat ? (
                  <AppText variant="secondary" numberOfLines={1}>
                    {lastPearlChat.title}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New Pearl chat"
              className="min-h-12 min-w-11 items-center justify-center px-3"
              onPress={startNewPearlChat}
            >
              <Icon
                as={SquarePenIcon}
                className="size-4 text-muted-foreground"
              />
            </Pressable>
          </View>
          {agents !== null && orderedAgents.length === 0 ? (
            onCreateAgent ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New agent"
                className="min-h-12 flex-row items-center gap-3 px-3 py-2"
                onPress={onCreateAgent}
              >
                <View
                  className="size-3.5 items-center justify-center rounded-full"
                  style={{ backgroundColor: "#2DD4BF" }}
                >
                  <View className="flex-row gap-0.5">
                    <View className="h-1.5 w-0.5 rounded-full bg-white" />
                    <View className="h-1.5 w-0.5 rounded-full bg-white" />
                  </View>
                </View>
                <AppText variant="body" weight="medium">
                  New Agent
                </AppText>
              </Pressable>
            ) : null
          ) : (
            orderedAgents.map((agent) => (
              <Pressable
                key={agent.id}
                accessibilityRole="button"
                accessibilityLabel={agent.name}
                className="min-h-12 w-full flex-row items-center gap-3 px-3 py-2"
                onPress={() => {
                  void selectChat(agent.chatId).then((selected) => {
                    if (selected) onOpenChat();
                  });
                }}
              >
                <View
                  className="size-3.5 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: agent.accent || "#2DD4BF",
                  }}
                >
                  <View className="flex-row gap-0.5">
                    <View className="h-1.5 w-0.5 rounded-full bg-white" />
                    <View className="h-1.5 w-0.5 rounded-full bg-white" />
                  </View>
                </View>
                <AppText
                  variant="body"
                  weight="medium"
                  className="min-w-0 flex-1"
                  numberOfLines={1}
                >
                  {agent.name}
                </AppText>
              </Pressable>
            ))
          )}
        </View>

        <View>
          <NavRowAndroid
            label="History"
            icon={ClockIcon}
            onPress={() => router.push("/history")}
          />
          <NavRowAndroid
            label="Workspaces"
            icon={FolderIcon}
            onPress={() => router.push("/workspaces")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function NavRowAndroid({
  label,
  icon,
  onPress,
}: {
  readonly label: string;
  readonly icon: typeof ClockIcon;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-12 w-full flex-row items-center gap-3 px-3 py-2"
      onPress={onPress}
    >
      <Icon as={icon} className="size-3.5 text-muted-foreground" />
      <AppText
        variant="body"
        weight="medium"
        className="min-w-0 flex-1"
        numberOfLines={1}
      >
        {label}
      </AppText>
      <Icon as={ChevronRightIcon} className="size-4 text-muted-foreground" />
    </Pressable>
  );
}
