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
import { CheckIcon, MoreHorizontalIcon, RotateCcwIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { TaskDateField } from "@/components/task-date-field";
import { Icon } from "@/components/ui/icon";
import {
  deleteIssueRequest,
  fetchIssueRequest,
  setIssueResolvedRequest,
  updateIssueRequest,
  type IssueDto,
} from "@/src/issues-client";

/** Task detail: edit fields on blur, resolve/delete from the native header. */
export function TaskDetailScreen({
  issueId,
}: {
  readonly issueId: string;
}) {
  const [issue, setIssue] = useState<IssueDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const applyIssue = useCallback((row: IssueDto) => {
    setIssue(row);
    setTitle(row.title);
    setDescription(row.description ?? "");
    setDueDate(row.dueDate ?? "");
    setReviewDate(row.reviewDate ?? "");
  }, []);

  const reload = useCallback(async () => {
    try {
      setError(null);
      applyIssue(await fetchIssueRequest(issueId));
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Failed to load task.";
      setError(message);
      if (message.toLowerCase().includes("not found")) {
        if (router.canGoBack()) router.back();
        else router.replace("/issues");
      }
    }
  }, [applyIssue, issueId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchIssueRequest(issueId);
        if (!cancelled) {
          applyIssue(row);
          setError(null);
        }
      } catch (cause) {
        if (cancelled) return;
        const message =
          cause instanceof Error ? cause.message : "Failed to load task.";
        setError(message);
        if (message.toLowerCase().includes("not found")) {
          if (router.canGoBack()) router.back();
          else router.replace("/issues");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyIssue, issueId]);

  const persist = useCallback(
    (patch: {
      readonly title: string;
      readonly description: string;
      readonly dueDate: string;
      readonly reviewDate: string;
    }) => {
      if (!issue || saving || !patch.title.trim()) return;
      const nextDescription = patch.description.trim() || null;
      const nextDue = patch.dueDate.trim() || null;
      const nextReview = patch.reviewDate.trim() || null;
      const changed =
        patch.title.trim() !== issue.title ||
        nextDescription !== (issue.description ?? null) ||
        nextDue !== (issue.dueDate ?? null) ||
        nextReview !== (issue.reviewDate ?? null);
      if (!changed) return;

      setSaving(true);
      setError(null);
      void updateIssueRequest(issueId, {
        title: patch.title.trim(),
        description: nextDescription,
        dueDate: nextDue,
        reviewDate: nextReview,
      })
        .then(applyIssue)
        .catch((cause) => {
          setError(
            cause instanceof Error ? cause.message : "Could not save.",
          );
        })
        .finally(() => setSaving(false));
    },
    [applyIssue, issue, issueId, saving],
  );

  const saveIfDirty = useCallback(() => {
    persist({ title, description, dueDate, reviewDate });
  }, [description, dueDate, persist, reviewDate, title]);

  const onDueChange = useCallback(
    (next: string) => {
      setDueDate(next);
      persist({ title, description, dueDate: next, reviewDate });
    },
    [description, persist, reviewDate, title],
  );

  const onReviewChange = useCallback(
    (next: string) => {
      setReviewDate(next);
      persist({ title, description, dueDate, reviewDate: next });
    },
    [description, dueDate, persist, title],
  );

  const toggleResolved = useCallback(() => {
    if (!issue || busy) return;
    setBusy(true);
    setError(null);
    void setIssueResolvedRequest(issueId, issue.status !== "resolved")
      .then(applyIssue)
      .catch((cause) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not update the task.",
        );
      })
      .finally(() => setBusy(false));
  }, [applyIssue, busy, issue, issueId]);

  const confirmDelete = useCallback(() => {
    Alert.alert("Delete task?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteIssueRequest(issueId)
            .then(() => {
              if (router.canGoBack()) router.back();
              else router.replace("/issues");
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
  }, [issueId]);

  const openOverflow = useCallback(() => {
    Alert.alert(title.trim() || "Task", undefined, [
      {
        text: "Delete task",
        style: "destructive",
        onPress: confirmDelete,
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [confirmDelete, title]);

  const resolved = issue?.status === "resolved";
  const headerTitle = issue?.title || "Task";

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
                      accessibilityLabel={
                        resolved ? "Reopen task" : "Complete task"
                      }
                      className="h-10 w-10 items-center justify-center"
                      disabled={!issue || busy}
                      onPress={toggleResolved}
                    >
                      <Icon
                        as={resolved ? RotateCcwIcon : CheckIcon}
                        className="size-5 text-foreground"
                      />
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
            icon={resolved ? "arrow.uturn.backward" : "checkmark"}
            accessibilityLabel={resolved ? "Reopen task" : "Complete task"}
            disabled={!issue || busy}
            onPress={toggleResolved}
          />
          <Stack.Toolbar.Button
            icon="ellipsis"
            accessibilityLabel="More actions"
            onPress={openOverflow}
          />
        </Stack.Toolbar>
      ) : null}

      {issue === null && !error ? (
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
            <TextInput
              accessibilityLabel="Task title"
              className="min-h-11 text-[28px] font-semibold tracking-tight text-foreground"
              maxLength={200}
              onBlur={saveIfDirty}
              onChangeText={setTitle}
              placeholder="What needs doing?"
              placeholderTextColor={placeholderColor}
              value={title}
            />
            <TextInput
              accessibilityLabel="Task notes"
              className="min-h-24 text-[16px] leading-6 text-foreground"
              multiline
              onBlur={saveIfDirty}
              onChangeText={setDescription}
              placeholder="Notes"
              placeholderTextColor={placeholderColor}
              textAlignVertical="top"
              value={description}
            />
            {saving ? (
              <Text className="text-xs text-muted-foreground">Saving…</Text>
            ) : null}
          </View>

          <View className="flex-row gap-3">
            <TaskDateField label="Due" value={dueDate} onChange={onDueChange} />
            <TaskDateField
              label="Review"
              value={reviewDate}
              onChange={onReviewChange}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
