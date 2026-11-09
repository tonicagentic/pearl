import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { useChats } from "@/src/chat-context";
import { createChat } from "@/src/chats-client";
import {
  createPlanRequest,
  deleteProjectRequest,
  fetchProjectWorkspace,
  updateProjectRequest,
  type ProjectWorkspaceDto,
} from "@/src/projects-client";

/** Project detail: edit metadata, plans, and project chats. */
export function ProjectDetailScreen({
  projectId,
}: {
  readonly projectId: string;
}) {
  const { selectChat, setActiveProjectId } = useChats();
  const [workspace, setWorkspace] = useState<ProjectWorkspaceDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const reload = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchProjectWorkspace(projectId);
      setWorkspace(data);
      setName(data.project.name);
      setInstructions(data.project.instructions);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to load project.",
      );
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchProjectWorkspace(projectId);
        if (!cancelled) {
          setWorkspace(data);
          setName(data.project.name);
          setInstructions(data.project.instructions);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Failed to load project.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const dirty =
    workspace !== null &&
    (name.trim() !== workspace.project.name ||
      instructions !== workspace.project.instructions);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={["left", "right"]}>
      {workspace === null && !error ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView className="flex-1 px-4" contentContainerClassName="pb-24 gap-5">
          {error ? (
            <Pressable onPress={() => void reload()}>
              <Text className="text-sm text-destructive">
                {error} Tap to retry.
              </Text>
            </Pressable>
          ) : null}

          <View className="gap-2 pt-2">
            <Text className="text-xs font-medium uppercase text-muted-foreground">
              Name
            </Text>
            <TextInput
              accessibilityLabel="Project name"
              className="min-h-11 rounded-lg border border-border px-3 text-base text-foreground"
              maxLength={120}
              onChangeText={setName}
              placeholderTextColor={placeholderColor}
              value={name}
            />
            <Text className="text-xs font-medium uppercase text-muted-foreground">
              Instructions
            </Text>
            <TextInput
              accessibilityLabel="Project instructions"
              className="min-h-28 rounded-lg border border-border px-3 py-2 text-base text-foreground"
              multiline
              onChangeText={setInstructions}
              placeholder="Optional instructions for this project"
              placeholderTextColor={placeholderColor}
              textAlignVertical="top"
              value={instructions}
            />
            <View className="flex-row gap-3">
              <Pressable
                accessibilityRole="button"
                className="min-h-11 flex-1 items-center justify-center rounded-lg bg-primary disabled:opacity-40"
                disabled={!dirty || saving || !name.trim()}
                onPress={() => {
                  setSaving(true);
                  setError(null);
                  void updateProjectRequest(projectId, {
                    name: name.trim(),
                    instructions,
                  })
                    .then((project) => {
                      setWorkspace((current) =>
                        current ? { ...current, project } : current,
                      );
                    })
                    .catch((cause) => {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not save.",
                      );
                    })
                    .finally(() => setSaving(false));
                }}
              >
                <Text className="text-sm font-medium text-primary-foreground">
                  {saving ? "Saving…" : "Save"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                className="min-h-11 items-center justify-center rounded-lg px-3"
                onPress={() => {
                  Alert.alert(
                    "Delete project?",
                    "Plans stay until you delete them separately; chats keep their history.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          void deleteProjectRequest(projectId)
                            .then(() => {
                              if (router.canGoBack()) router.back();
                              else router.replace("/projects");
                            })
                            .catch((cause) => {
                              setError(
                                cause instanceof Error
                                  ? cause.message
                                  : "Could not delete.",
                              );
                            });
                        },
                      },
                    ],
                  );
                }}
              >
                <Text className="text-sm text-destructive">Delete</Text>
              </Pressable>
            </View>
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-foreground">
                Plans
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={creatingPlan}
                onPress={() => {
                  setCreatingPlan(true);
                  setError(null);
                  void createPlanRequest(projectId, {
                    title: "Untitled plan",
                    markdown: "",
                  })
                    .then((plan) => {
                      router.push(
                        `/projects/${encodeURIComponent(projectId)}/plans/${encodeURIComponent(plan.id)}`,
                      );
                    })
                    .catch((cause) => {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not create plan.",
                      );
                    })
                    .finally(() => setCreatingPlan(false));
                }}
              >
                <Text className="text-sm font-medium text-foreground">
                  {creatingPlan ? "Creating…" : "New plan"}
                </Text>
              </Pressable>
            </View>
            {(workspace?.plans ?? []).length === 0 ? (
              <Text className="text-sm text-muted-foreground">
                No plans yet.
              </Text>
            ) : (
              (workspace?.plans ?? []).map((plan) => (
                <Pressable
                  key={plan.id}
                  accessibilityRole="button"
                  className="min-h-11 justify-center border-b border-border/60 py-2.5"
                  onPress={() =>
                    router.push(
                      `/projects/${encodeURIComponent(projectId)}/plans/${encodeURIComponent(plan.id)}`,
                    )
                  }
                >
                  <Text className="text-base text-foreground">{plan.title}</Text>
                </Pressable>
              ))
            )}
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-foreground">
                Chats
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={creatingChat}
                onPress={() => {
                  setCreatingChat(true);
                  setError(null);
                  void createChat(undefined, projectId)
                    .then(async (chat) => {
                      setActiveProjectId(projectId);
                      router.replace("/");
                      await selectChat(chat.id);
                    })
                    .catch((cause) => {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not start chat.",
                      );
                    })
                    .finally(() => setCreatingChat(false));
                }}
              >
                <Text className="text-sm font-medium text-foreground">
                  {creatingChat ? "Starting…" : "New chat"}
                </Text>
              </Pressable>
            </View>
            {(workspace?.chats ?? []).length === 0 ? (
              <Text className="text-sm text-muted-foreground">
                No chats in this project yet.
              </Text>
            ) : (
              (workspace?.chats ?? []).map((chat) => (
                <Pressable
                  key={chat.id}
                  accessibilityRole="button"
                  className="min-h-11 justify-center border-b border-border/60 py-2.5"
                  onPress={() => {
                    setActiveProjectId(projectId);
                    router.replace("/");
                    void selectChat(chat.id);
                  }}
                >
                  <Text className="text-base text-foreground">{chat.title}</Text>
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
