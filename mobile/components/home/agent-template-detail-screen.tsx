import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AgentTemplateDetailBody,
  useAgentTemplateDetail,
} from "@/components/home/agent-template-browser";
import { Button } from "@/components/ui/button";
import { addAgentFromTemplateRequest } from "@/src/agent-templates-client";
import { useActiveChat } from "@/src/chat-context";
import { usePearlScreenBackground } from "@/src/navigation-theme";
import { fetchProjects, type ProjectDto } from "@/src/projects-client";

/** Template detail — review standing instructions / kit, then add into a project. */
export function AgentTemplateDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectChat } = useActiveChat();
  const backgroundColor = usePearlScreenBackground();
  const params = useLocalSearchParams<{
    readonly slug?: string;
    readonly projectId?: string;
  }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const fixedProjectId =
    typeof params.projectId === "string" ? params.projectId : null;
  const [projectId, setProjectId] = useState(fixedProjectId);
  const [projects, setProjects] = useState<readonly ProjectDto[]>([]);
  const { template, error, setError, reload } = useAgentTemplateDetail(
    slug || null,
    projectId,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (fixedProjectId) return;
    void fetchProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [fixedProjectId]);

  const openAgentChat = (chatId: string) => {
    void selectChat(chatId).then((ok) => {
      if (!ok) return;
      router.push("/agents/chat", { withAnchor: true });
    });
  };

  const pickProjectThenAdd = () => {
    if (!template || busy) return;
    if (template.addedChatId && projectId) {
      openAgentChat(template.addedChatId);
      return;
    }
    const target = projectId;
    if (!target) {
      if (projects.length === 0) {
        Alert.alert(
          "No projects",
          "Create a project in Workspaces first, then add this template.",
        );
        return;
      }
      Alert.alert(
        "Add to project",
        "Choose which project gets this agent.",
        [
          ...projects.slice(0, 5).map((row) => ({
            text: row.name,
            onPress: () => {
              setProjectId(row.id);
              void runAdd(row.id);
            },
          })),
          { text: "Cancel", style: "cancel" as const },
        ],
      );
      return;
    }
    void runAdd(target);
  };

  const runAdd = async (targetProjectId: string) => {
    if (!template) return;
    setBusy(true);
    setError(null);
    try {
      const agent = await addAgentFromTemplateRequest(
        template.slug,
        targetProjectId,
      );
      openAgentChat(agent.chatId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not add agent.",
      );
      setBusy(false);
      reload();
    }
  };

  const buttonLabel = useMemo(() => {
    if (template?.addedChatId && projectId) return "Open agent";
    if (busy) return "Adding…";
    return "Add to project";
  }, [template?.addedChatId, projectId, busy]);

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
            label={buttonLabel}
            onPress={pickProjectThenAdd}
            disabled={busy}
          />
        </View>
      ) : null}
    </View>
  );
}
