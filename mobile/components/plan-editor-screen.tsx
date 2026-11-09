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

import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import { revealChatThread } from "@/components/chat-history-push";
import { setAgentMode } from "@/src/agent-mode";
import { useChats } from "@/src/chat-context";
import {
  carryOutPlanRequest,
  deletePlanRequest,
  fetchPlan,
  updatePlanRequest,
  type PlanDto,
} from "@/src/projects-client";

/** Plan editor: title + markdown TextInput, preview, Save, Delete, Carry out. */
export function PlanEditorScreen({
  projectId,
  planId,
}: {
  readonly projectId: string;
  readonly planId: string;
}) {
  const { selectChat, setActiveProjectId } = useChats();
  const [plan, setPlan] = useState<PlanDto | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [carryingOut, setCarryingOut] = useState(false);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const reload = useCallback(async () => {
    try {
      setError(null);
      const row = await fetchPlan(projectId, planId);
      setPlan(row);
      setTitle(row.title);
      setMarkdown(row.markdown);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to load plan.",
      );
    }
  }, [projectId, planId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchPlan(projectId, planId);
        if (!cancelled) {
          setPlan(row);
          setTitle(row.title);
          setMarkdown(row.markdown);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Failed to load plan.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, planId]);

  const dirty =
    plan !== null &&
    (title.trim() !== plan.title || markdown !== plan.markdown);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={["left", "right"]}>
      {plan === null && !error ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          contentContainerClassName="pb-28 gap-4 pt-2"
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <Pressable onPress={() => void reload()}>
              <Text className="text-sm text-destructive">
                {error} Tap to retry.
              </Text>
            </Pressable>
          ) : null}

          <TextInput
            accessibilityLabel="Plan title"
            className="min-h-11 rounded-lg border border-border px-3 text-lg font-semibold text-foreground"
            maxLength={200}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor={placeholderColor}
            value={title}
          />

          <View className="flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: !preview }}
              className={`min-h-9 flex-1 items-center justify-center rounded-lg ${preview ? "bg-muted" : "bg-accent"}`}
              onPress={() => setPreview(false)}
            >
              <Text className="text-sm font-medium text-foreground">Edit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: preview }}
              className={`min-h-9 flex-1 items-center justify-center rounded-lg ${preview ? "bg-accent" : "bg-muted"}`}
              onPress={() => setPreview(true)}
            >
              <Text className="text-sm font-medium text-foreground">
                Preview
              </Text>
            </Pressable>
          </View>

          {preview ? (
            <View className="min-h-48 rounded-lg border border-border/60 px-3 py-2">
              {markdown.trim() ? (
                <MarkdownText
                  type="text"
                  text={markdown}
                  status={{ type: "complete" }}
                />
              ) : (
                <Text className="text-sm text-muted-foreground">
                  Nothing to preview yet.
                </Text>
              )}
            </View>
          ) : (
            <TextInput
              accessibilityLabel="Plan markdown"
              className="min-h-64 rounded-lg border border-border px-3 py-2 text-base text-foreground"
              multiline
              onChangeText={setMarkdown}
              placeholder="Write the plan in markdown…"
              placeholderTextColor={placeholderColor}
              textAlignVertical="top"
              value={markdown}
            />
          )}

          <View className="flex-row flex-wrap gap-3">
            <Pressable
              accessibilityRole="button"
              className="min-h-11 flex-1 items-center justify-center rounded-lg bg-primary disabled:opacity-40"
              disabled={!dirty || saving || !title.trim()}
              onPress={() => {
                setSaving(true);
                setError(null);
                void updatePlanRequest(projectId, planId, {
                  title: title.trim(),
                  markdown,
                })
                  .then((row) => setPlan(row))
                  .catch((cause) => {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not save plan.",
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
              className="min-h-11 flex-1 items-center justify-center rounded-lg border border-border"
              disabled={carryingOut}
              onPress={() => {
                setCarryingOut(true);
                setError(null);
                void (async () => {
                  if (dirty) {
                    const row = await updatePlanRequest(projectId, planId, {
                      title: title.trim() || plan?.title || "Untitled plan",
                      markdown,
                    });
                    setPlan(row);
                  }
                  const result = await carryOutPlanRequest(projectId, planId);
                  setAgentMode("agent");
                  setActiveProjectId(result.projectId);
                  revealChatThread();
                  router.replace("/");
                  await selectChat(result.chatId);
                })()
                  .catch((cause) => {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not carry out the plan.",
                    );
                  })
                  .finally(() => setCarryingOut(false));
              }}
            >
              <Text className="text-sm font-medium text-foreground">
                {carryingOut ? "Starting…" : "Carry out"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="min-h-11 items-center justify-center px-2"
              onPress={() => {
                Alert.alert("Delete plan?", "This cannot be undone.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                      void deletePlanRequest(projectId, planId)
                        .then(() => {
                          if (router.canGoBack()) router.back();
                          else
                            router.replace(
                              `/projects/${encodeURIComponent(projectId)}`,
                            );
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
                ]);
              }}
            >
              <Text className="text-sm text-destructive">Delete</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
