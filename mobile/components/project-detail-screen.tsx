import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { revealChatThread } from "@/components/chat-history-push";
import { ProjectMark } from "@/components/project-mark";
import { Icon } from "@/components/ui/icon";
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
  const foregroundColor = useCSSVariable("--color-foreground") as
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

  const saveIfDirty = useCallback(() => {
    if (!workspace || !dirty || saving || !name.trim()) return;
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
        setName(project.name);
        setInstructions(project.instructions);
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not save.",
        );
      })
      .finally(() => setSaving(false));
  }, [dirty, instructions, name, projectId, saving, workspace]);

  const createPlan = useCallback(() => {
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
          cause instanceof Error ? cause.message : "Could not create plan.",
        );
      })
      .finally(() => setCreatingPlan(false));
  }, [projectId]);

  const createProjectChat = useCallback(() => {
    setCreatingChat(true);
    setError(null);
    void createChat(undefined, projectId)
      .then(async (chat) => {
        setActiveProjectId(projectId);
        revealChatThread();
        await selectChat(chat.id);
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not start chat.",
        );
      })
      .finally(() => setCreatingChat(false));
  }, [projectId, selectChat, setActiveProjectId]);

  const confirmDelete = useCallback(() => {
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
  }, [projectId]);

  const openPlusMenu = useCallback(() => {
    Alert.alert("New", undefined, [
      {
        text: creatingPlan ? "Creating plan…" : "New plan",
        onPress: createPlan,
      },
      {
        text: creatingChat ? "Starting chat…" : "New chat",
        onPress: createProjectChat,
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [createPlan, createProjectChat, creatingChat, creatingPlan]);

  const openOverflow = useCallback(() => {
    Alert.alert(name.trim() || "Project", undefined, [
      {
        text: "Delete project",
        style: "destructive",
        onPress: confirmDelete,
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [confirmDelete, name]);

  const headerTitle = workspace?.project.name || "Project";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor }}
      edges={["left", "right"]}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: headerTitle,
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: foregroundColor,
          headerRight:
            Platform.OS === "ios"
              ? undefined
              : () => (
                  <View className="flex-row items-center">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="New plan or chat"
                      className="h-10 w-10 items-center justify-center"
                      disabled={creatingPlan || creatingChat}
                      onPress={openPlusMenu}
                    >
                      <Icon as={PlusIcon} className="size-5 text-foreground" />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="More actions"
                      className="h-10 w-10 items-center justify-center"
                      onPress={openOverflow}
                    >
                      <Icon
                        as={MoreHorizontalIcon}
                        className="size-5 text-foreground"
                      />
                    </Pressable>
                  </View>
                ),
        }}
      />
      {Platform.OS === "ios" ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="plus"
            accessibilityLabel="New plan or chat"
            disabled={creatingPlan || creatingChat}
            onPress={openPlusMenu}
          />
          <Stack.Toolbar.Button
            icon="ellipsis"
            accessibilityLabel="More actions"
            onPress={openOverflow}
          />
        </Stack.Toolbar>
      ) : null}

      {workspace === null && !error ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pb-24 gap-6 pt-4"
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <Pressable onPress={() => void reload()}>
              <Text className="text-sm text-destructive">
                {error} Tap to retry.
              </Text>
            </Pressable>
          ) : null}

          <View className="gap-3">
            <ProjectMark
              name={name || workspace?.project.name || "project"}
              size="lg"
            />
            <TextInput
              accessibilityLabel="Project name"
              className="min-h-11 text-[28px] font-semibold tracking-tight text-foreground"
              maxLength={120}
              onBlur={saveIfDirty}
              onChangeText={setName}
              placeholder="Project name"
              placeholderTextColor={placeholderColor}
              value={name}
            />
            <TextInput
              accessibilityLabel="Project summary"
              className="min-h-16 text-[16px] leading-6 text-foreground"
              multiline
              onBlur={saveIfDirty}
              onChangeText={setInstructions}
              placeholder="Short summary…"
              placeholderTextColor={placeholderColor}
              textAlignVertical="top"
              value={instructions}
            />
            {saving ? (
              <Text className="text-xs text-muted-foreground">Saving…</Text>
            ) : null}
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                Plans
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={creatingPlan}
                onPress={createPlan}
              >
                <Text className="text-sm font-medium text-foreground">
                  {creatingPlan ? "Creating…" : "New"}
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
                  className="min-h-11 justify-center border-b border-border/40 py-2.5"
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
              <Text className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                Chats
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={creatingChat}
                onPress={createProjectChat}
              >
                <Text className="text-sm font-medium text-foreground">
                  {creatingChat ? "Starting…" : "New"}
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
                  className="min-h-11 justify-center border-b border-border/40 py-2.5"
                  onPress={() => {
                    setActiveProjectId(projectId);
                    revealChatThread();
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
