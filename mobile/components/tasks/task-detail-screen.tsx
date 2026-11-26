import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { CheckIcon, MoreHorizontalIcon, RotateCcwIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import {
  ScreenChrome,
  type ScreenChromeAction,
} from "@/components/navigation/screen-chrome";
import { TaskDateField } from "@/components/tasks/task-date-field";
import { LoadingCenter } from "@/components/ui/loading-center";
import { Text, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
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
        else router.replace("/");
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
          else router.replace("/");
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
              else router.replace("/");
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
  const chromeActions = useMemo((): readonly ScreenChromeAction[] => {
    if (issue === null && !error) return [];
    return [
      {
        label: resolved ? "Reopen task" : "Complete task",
        systemImage: resolved ? "arrow.uturn.backward" : "checkmark",
        icon: resolved ? RotateCcwIcon : CheckIcon,
        onPress: toggleResolved,
        disabled: !issue || busy,
      },
      {
        label: "More actions",
        systemImage: "ellipsis",
        icon: MoreHorizontalIcon,
        onPress: openOverflow,
      },
    ];
  }, [busy, error, issue, openOverflow, resolved, toggleResolved]);

  return (
    <ScreenChrome
      title={headerTitle}
      leading="back"
      contentPaddingTop={0}
      actions={chromeActions}
    >
      {issue === null && !error ? (
        <LoadingCenter />
      ) : (
        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pb-24 gap-6 pt-4"
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <Pressable onPress={() => void reload()}>
              <Text variant="secondary" tone="destructive">
                {error} Tap to retry.
              </Text>
            </Pressable>
          ) : null}

          <View className="gap-3">
            <TextInput
              accessibilityLabel="Task title"
              className={cn(
                "min-h-11 tracking-tight",
                textVariants({ variant: "display" }),
              )}
              maxLength={200}
              onBlur={saveIfDirty}
              onChangeText={setTitle}
              placeholder="What needs doing?"
              placeholderTextColor={placeholderColor}
              value={title}
            />
            <TextInput
              accessibilityLabel="Task notes"
              className={cn("min-h-24", textVariants({ variant: "body" }))}
              multiline
              onBlur={saveIfDirty}
              onChangeText={setDescription}
              placeholder="Notes"
              placeholderTextColor={placeholderColor}
              textAlignVertical="top"
              value={description}
            />
            {saving ? <Text variant="caption">Saving…</Text> : null}
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
    </ScreenChrome>
  );
}
