import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AgentTemplateDetailBody,
  useAgentTemplateDetail,
} from "@/components/home/agent-template-browser";
import { Button } from "@/components/ui/button";
import { addAgentFromTemplateRequest } from "@/src/agent-templates-client";
import { useChats } from "@/src/chat-context";
import { usePearlScreenBackground } from "@/src/navigation-theme";

/** Template detail — review standing instructions / kit, then add or open. */
export function AgentTemplateDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectChat } = useChats();
  const backgroundColor = usePearlScreenBackground();
  const params = useLocalSearchParams<{ readonly slug?: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const { template, error, setError, reload } = useAgentTemplateDetail(
    slug || null,
  );
  const [busy, setBusy] = useState(false);

  const openAgentChat = (chatId: string) => {
    void selectChat(chatId).then((ok) => {
      if (!ok) return;
      router.push("/chat", { withAnchor: true });
    });
  };

  const addOrOpen = () => {
    if (!template || busy) return;
    if (template.addedChatId) {
      openAgentChat(template.addedChatId);
      return;
    }
    setBusy(true);
    setError(null);
    void addAgentFromTemplateRequest(template.slug)
      .then((agent) => {
        openAgentChat(agent.chatId);
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not add agent.",
        );
        setBusy(false);
        reload();
      });
  };

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <Stack.Screen
        options={{
          title: template?.name ?? "Agent",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-6 pt-4"
        contentInsetAdjustmentBehavior="automatic"
      >
        <AgentTemplateDetailBody template={template} error={error} />
      </ScrollView>
      {template ? (
        <View
          className="border-t border-border px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Button
            label={
              template.addedChatId
                ? "Open agent"
                : busy
                  ? "Adding…"
                  : "Add agent"
            }
            loading={busy}
            loadingLabel="Adding…"
            disabled={busy}
            onPress={addOrOpen}
          />
        </View>
      ) : null}
    </View>
  );
}
