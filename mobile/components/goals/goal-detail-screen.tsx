import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  CheckIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RotateCcwIcon,
} from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { revealChatThread } from "@/components/chat-history-push";
import {
  ScreenChrome,
  type ScreenChromeAction,
} from "@/components/navigation/screen-chrome";
import { ProjectPickerModal } from "@/components/project-picker-modal";
import { CreateTaskModal } from "@/components/tasks/create-task-modal";
import { TaskDateField } from "@/components/tasks/task-date-field";
import { TaskRow } from "@/components/tasks/task-row";
import { Icon } from "@/components/ui/icon";
import { LoadingCenter } from "@/components/ui/loading-center";
import { Text, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useChats } from "@/src/chat-context";
import {
  attachChatToGoal,
  createChat,
  type ChatListItem,
} from "@/src/chats-client";
import {
  deleteGoalRequest,
  fetchGoalWorkspace,
  updateGoalRequest,
  type GoalNoteSummaryDto,
  type GoalWorkspaceDto,
} from "@/src/goals-client";
import {
  deleteIssueRequest,
  setIssueResolvedRequest,
  type IssueDto,
} from "@/src/issues-client";
import {
  createNoteRequest,
  fetchAllNotes,
  updateNoteRequest,
} from "@/src/notes-client";
import { queryKeys } from "@/src/query-client";

/** Goal detail: edit fields, tasks, chats, and notes. */
export function GoalDetailScreen({
  goalId,
}: {
  readonly goalId: string;
}) {
  const queryClient = useQueryClient();
  const { chats, selectChat, setActiveProjectId } = useChats();
  const [workspace, setWorkspace] = useState<GoalWorkspaceDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const applyWorkspace = useCallback((row: GoalWorkspaceDto) => {
    setWorkspace(row);
    setTitle(row.goal.title);
    setNotes(row.goal.notes ?? "");
    setTargetDate(row.goal.targetDate ?? "");
  }, []);

  const reload = useCallback(async () => {
    try {
      setError(null);
      applyWorkspace(await fetchGoalWorkspace(goalId));
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Failed to load goal.";
      setError(message);
      if (message.toLowerCase().includes("not found")) {
        if (router.canGoBack()) router.back();
        else router.replace("/goals");
      }
    }
  }, [applyWorkspace, goalId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchGoalWorkspace(goalId);
        if (!cancelled) {
          applyWorkspace(row);
          setError(null);
        }
      } catch (cause) {
        if (cancelled) return;
        const message =
          cause instanceof Error ? cause.message : "Failed to load goal.";
        setError(message);
        if (message.toLowerCase().includes("not found")) {
          if (router.canGoBack()) router.back();
          else router.replace("/goals");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyWorkspace, goalId]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.goals });
    void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
  }, [queryClient]);

  const persist = useCallback(
    (patch: {
      readonly title: string;
      readonly notes: string;
      readonly targetDate: string;
    }) => {
      if (!workspace || saving || !patch.title.trim()) return;
      const nextNotes = patch.notes.trim() || null;
      const nextTarget = patch.targetDate.trim() || null;
      const changed =
        patch.title.trim() !== workspace.goal.title ||
        nextNotes !== (workspace.goal.notes ?? null) ||
        nextTarget !== (workspace.goal.targetDate ?? null);
      if (!changed) return;

      setSaving(true);
      setError(null);
      void updateGoalRequest(goalId, {
        title: patch.title.trim(),
        notes: nextNotes,
        targetDate: nextTarget,
      })
        .then((goal) => {
          setWorkspace((current) =>
            current ? { ...current, goal } : current,
          );
          invalidate();
        })
        .catch((cause) => {
          setError(
            cause instanceof Error ? cause.message : "Could not save.",
          );
        })
        .finally(() => setSaving(false));
    },
    [goalId, invalidate, saving, workspace],
  );

  const saveIfDirty = useCallback(() => {
    persist({ title, notes, targetDate });
  }, [notes, persist, targetDate, title]);

  const onTargetChange = useCallback(
    (next: string) => {
      setTargetDate(next);
      persist({ title, notes, targetDate: next });
    },
    [notes, persist, title],
  );

  const toggleDone = useCallback(() => {
    if (!workspace || busy) return;
    setBusy(true);
    setError(null);
    const nextStatus = workspace.goal.status === "done" ? "active" : "done";
    void updateGoalRequest(goalId, { status: nextStatus })
      .then((goal) => {
        setWorkspace((current) =>
          current ? { ...current, goal } : current,
        );
        invalidate();
      })
      .catch((cause) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not update the goal.",
        );
      })
      .finally(() => setBusy(false));
  }, [busy, goalId, invalidate, workspace]);

  const confirmDelete = useCallback(() => {
    Alert.alert("Delete goal?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteGoalRequest(goalId)
            .then(() => {
              invalidate();
              if (router.canGoBack()) router.back();
              else router.replace("/goals");
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
  }, [goalId, invalidate]);

  const setProject = useCallback(
    (projectId: string | null, projectName: string | null) => {
      setError(null);
      void updateGoalRequest(goalId, { projectId })
        .then((goal) => {
          setWorkspace((current) =>
            current
              ? {
                  ...current,
                  goal: {
                    ...goal,
                    projectName: projectName ?? goal.projectName,
                  },
                }
              : current,
          );
          invalidate();
        })
        .catch((cause) => {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not update project.",
          );
        });
    },
    [goalId, invalidate],
  );

  const resolveTask = useCallback(
    (issue: IssueDto, resolved: boolean) => {
      setBusyTaskId(issue.id);
      void setIssueResolvedRequest(issue.id, resolved)
        .then((updated) => {
          setWorkspace((current) =>
            current
              ? {
                  ...current,
                  tasks: current.tasks.map((row) =>
                    row.id === updated.id ? updated : row,
                  ),
                }
              : current,
          );
          invalidate();
        })
        .catch((cause) => {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not update the task.",
          );
        })
        .finally(() => setBusyTaskId(null));
    },
    [invalidate],
  );

  const deleteTask = useCallback(
    (issue: IssueDto) => {
      Alert.alert("Delete task?", issue.title, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setBusyTaskId(issue.id);
            void deleteIssueRequest(issue.id)
              .then(() => {
                setWorkspace((current) =>
                  current
                    ? {
                        ...current,
                        tasks: current.tasks.filter(
                          (row) => row.id !== issue.id,
                        ),
                      }
                    : current,
                );
                invalidate();
              })
              .catch((cause) => {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Could not delete the task.",
                );
              })
              .finally(() => setBusyTaskId(null));
          },
        },
      ]);
    },
    [invalidate],
  );

  const startGoalChat = useCallback(() => {
    const projectId = workspace?.goal.projectId ?? null;
    const seed = `Let's work on: ${title.trim() || "this goal"}`;
    void createChat(seed, projectId, goalId)
      .then(async (created) => {
        if (projectId) setActiveProjectId(projectId);
        revealChatThread();
        await selectChat(created.id);
        await reload();
        router.navigate("/");
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not start chat.",
        );
      });
  }, [
    goalId,
    reload,
    selectChat,
    setActiveProjectId,
    title,
    workspace?.goal.projectId,
  ]);

  const attachExistingChat = useCallback(() => {
    const linkedIds = new Set(
      (workspace?.chats ?? []).map((chat) => chat.id),
    );
    const available = chats.filter((chat) => !linkedIds.has(chat.id));
    if (available.length === 0) {
      Alert.alert(
        "No chats to attach",
        "Start a new chat, or pick one from History.",
      );
      return;
    }
    Alert.alert("Attach chat", undefined, [
      ...available.slice(0, 6).map((chat: ChatListItem) => ({
        text: chat.title || "Untitled",
        onPress: () => {
          void attachChatToGoal(
            chat.id,
            goalId,
            workspace?.goal.projectId ?? null,
          )
            .then(() => reload())
            .catch((cause) => {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Could not attach chat.",
              );
            });
        },
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }, [chats, goalId, reload, workspace?.chats, workspace?.goal.projectId]);

  const openChatMenu = useCallback(() => {
    Alert.alert("Chats", undefined, [
      { text: "New chat", onPress: startGoalChat },
      { text: "Attach existing", onPress: attachExistingChat },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [attachExistingChat, startGoalChat]);

  const createNote = useCallback(() => {
    void createNoteRequest({
      projectId: workspace?.goal.projectId ?? null,
      goalId,
    })
      .then((note) => {
        void reload();
        router.push(`/notes/${encodeURIComponent(note.id)}`);
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not create note.",
        );
      });
  }, [goalId, reload, workspace?.goal.projectId]);

  const linkExistingNote = useCallback(() => {
    void fetchAllNotes()
      .then((all) => {
        const linked = new Set((workspace?.notes ?? []).map((n) => n.id));
        const available = all.filter((note) => !linked.has(note.id));
        if (available.length === 0) {
          Alert.alert("No notes to attach", "Create a note first.");
          return;
        }
        Alert.alert("Attach note", undefined, [
          ...available.slice(0, 6).map((note) => ({
            text: note.title || "Untitled",
            onPress: () => {
              void updateNoteRequest(note.id, {
                goalId,
                projectId:
                  workspace?.goal.projectId ?? note.projectId ?? null,
              })
                .then(() => reload())
                .catch((cause) => {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not attach note.",
                  );
                });
            },
          })),
          { text: "Cancel", style: "cancel" as const },
        ]);
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not load notes.",
        );
      });
  }, [goalId, reload, workspace?.goal.projectId, workspace?.notes]);

  const openNoteMenu = useCallback(() => {
    Alert.alert("Notes", undefined, [
      { text: "New note", onPress: createNote },
      { text: "Attach existing", onPress: linkExistingNote },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [createNote, linkExistingNote]);

  const openOverflow = useCallback(() => {
    Alert.alert(title.trim() || "Goal", undefined, [
      {
        text: "Delete goal",
        style: "destructive",
        onPress: confirmDelete,
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [confirmDelete, title]);

  const openProjectPicker = useCallback(() => {
    Alert.alert("Project", undefined, [
      {
        text: "Choose project",
        onPress: () => setProjectPickerOpen(true),
      },
      ...(workspace?.goal.projectId
        ? [
            {
              text: "Clear project",
              onPress: () => setProject(null, null),
            },
          ]
        : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }, [setProject, workspace?.goal.projectId]);

  const done = workspace?.goal.status === "done";
  const headerTitle = workspace?.goal.title || "Goal";
  const chromeActions = useMemo((): readonly ScreenChromeAction[] => {
    if (workspace === null && !error) return [];
    return [
      {
        label: done ? "Reopen goal" : "Complete goal",
        systemImage: done ? "arrow.uturn.backward" : "checkmark",
        icon: done ? RotateCcwIcon : CheckIcon,
        onPress: toggleDone,
        disabled: !workspace || busy,
      },
      {
        label: "More actions",
        systemImage: "ellipsis",
        icon: MoreHorizontalIcon,
        onPress: openOverflow,
      },
    ];
  }, [busy, done, error, openOverflow, toggleDone, workspace]);

  const tasks = workspace?.tasks ?? [];
  const goalChats = workspace?.chats ?? [];
  const goalNotes = workspace?.notes ?? [];

  return (
    <ScreenChrome
      title={headerTitle}
      leading="back"
      contentPaddingTop={0}
      actions={chromeActions}
    >
      {workspace === null && !error ? (
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
              accessibilityLabel="Goal title"
              className={cn(
                "min-h-11 tracking-tight",
                textVariants({ variant: "display" }),
              )}
              maxLength={200}
              onBlur={saveIfDirty}
              onChangeText={setTitle}
              placeholder="Goal"
              placeholderTextColor={placeholderColor}
              value={title}
            />
            <TextInput
              accessibilityLabel="Goal notes"
              className={cn("min-h-24", textVariants({ variant: "body" }))}
              multiline
              onBlur={saveIfDirty}
              onChangeText={setNotes}
              placeholder="Notes"
              placeholderTextColor={placeholderColor}
              textAlignVertical="top"
              value={notes}
            />
            {saving ? <Text variant="caption">Saving…</Text> : null}
          </View>

          <View className="flex-row flex-wrap gap-2">
            <TaskDateField
              label="Target"
              value={targetDate}
              onChange={onTargetChange}
            />
            <Pressable
              accessibilityRole="button"
              className="min-h-11 flex-1 justify-center rounded-xl border border-border/50 bg-muted/40 px-3"
              onPress={openProjectPicker}
            >
              <Text variant="caption">Project</Text>
              <Text variant="body" numberOfLines={1}>
                {workspace?.goal.projectName ?? "None"}
              </Text>
            </Pressable>
          </View>

          <SourceSection
            title="Tasks"
            onAdd={() => setCreateTaskOpen(true)}
          >
            {tasks.length === 0 ? (
              <EmptyRow text="No tasks yet." />
            ) : (
              <View className="overflow-hidden rounded-2xl bg-muted/35">
                {tasks.map((issue, index) => (
                  <TaskRow
                    key={issue.id}
                    issue={issue}
                    index={index}
                    busy={busyTaskId === issue.id}
                    onResolve={resolveTask}
                    onDelete={deleteTask}
                  />
                ))}
              </View>
            )}
          </SourceSection>

          <SourceSection title="Chats" onAdd={openChatMenu} addLabel="Add">
            {goalChats.length === 0 ? (
              <EmptyRow text="No chats yet." />
            ) : (
              <View className="overflow-hidden rounded-2xl bg-muted/35">
                {goalChats.map((chat, index) => (
                  <LinkRow
                    key={chat.id}
                    first={index === 0}
                    title={chat.title || "Untitled"}
                    subtitle={new Date(chat.updatedAt).toLocaleDateString()}
                    onPress={() => {
                      const projectId = workspace?.goal.projectId ?? null;
                      if (projectId) setActiveProjectId(projectId);
                      revealChatThread();
                      void selectChat(chat.id);
                      router.navigate("/");
                    }}
                  />
                ))}
              </View>
            )}
          </SourceSection>

          <SourceSection title="Notes" onAdd={openNoteMenu} addLabel="Add">
            {goalNotes.length === 0 ? (
              <EmptyRow text="No notes yet." />
            ) : (
              <View className="overflow-hidden rounded-2xl bg-muted/35">
                {goalNotes.map((note: GoalNoteSummaryDto, index) => (
                  <LinkRow
                    key={note.id}
                    first={index === 0}
                    title={note.title}
                    subtitle={new Date(note.updatedAt).toLocaleDateString()}
                    onPress={() =>
                      router.push(`/notes/${encodeURIComponent(note.id)}`)
                    }
                  />
                ))}
              </View>
            )}
          </SourceSection>
        </ScrollView>
      )}

      <CreateTaskModal
        open={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        onCreated={() => {
          setCreateTaskOpen(false);
          void reload();
          invalidate();
        }}
        projectId={workspace?.goal.projectId ?? null}
        goalId={goalId}
      />

      <ProjectPickerModal
        open={projectPickerOpen}
        onClose={() => setProjectPickerOpen(false)}
        description="File this goal on a project, or create a new one."
        onSelect={(project) => {
          setProjectPickerOpen(false);
          setProject(project.id, project.name);
        }}
      />
    </ScreenChrome>
  );
}

function SourceSection({
  title,
  onAdd,
  addLabel = "Add",
  children,
}: {
  readonly title: string;
  readonly onAdd: () => void;
  readonly addLabel?: string;
  readonly children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text
          variant="secondary"
          weight="medium"
          className="uppercase tracking-wide"
        >
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${addLabel} ${title}`}
          className="flex-row items-center gap-1"
          onPress={onAdd}
        >
          <Icon as={PlusIcon} className="size-3.5 text-muted-foreground" />
          <Text variant="secondary">{addLabel}</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function EmptyRow({ text }: { readonly text: string }) {
  return (
    <View className="overflow-hidden rounded-2xl bg-muted/35 px-3.5 py-4">
      <Text variant="secondary">{text}</Text>
    </View>
  );
}

function LinkRow({
  title,
  subtitle,
  onPress,
  first,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly onPress: () => void;
  readonly first?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-11 justify-center px-3.5 py-3.5 active:opacity-80 ${first ? "" : "border-t border-border/40"}`}
      onPress={onPress}
    >
      <Text variant="body" weight="medium" numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="caption" className="mt-0.5" numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}
