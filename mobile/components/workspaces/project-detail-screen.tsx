import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import {
  CheckIcon,
  MoreHorizontalIcon,
  PlusIcon,
} from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { revealChatThread } from "@/components/chat-history-push";
import { ProjectMark } from "@/components/project-mark";
import { CreateTaskModal } from "@/components/tasks/create-task-modal";
import { Icon } from "@/components/ui/icon";
import { LoadingCenter } from "@/components/ui/loading-center";
import { StackScreen } from "@/components/ui/stack-screen";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { listArtifacts } from "@/src/artifacts-client";
import { useChats } from "@/src/chat-context";
import { attachChatToProject, createChat } from "@/src/chats-client";
import {
  deleteIssueRequest,
  setIssueResolvedRequest,
} from "@/src/issues-client";
import {
  createProjectFileRequest,
  createProjectGoalRequest,
  createProjectNoteRequest,
  deleteProjectGoalRequest,
  deleteProjectRequest,
  fetchProjectWorkspace,
  linkProjectArtifactRequest,
  linkProjectPinRequest,
  unlinkProjectArtifactRequest,
  unlinkProjectPinRequest,
  updateProjectGoalRequest,
  updateProjectRequest,
  type ProjectGoalDto,
  type ProjectIssueDto,
  type ProjectWorkspaceDto,
} from "@/src/projects-client";
import { fetchWorkbenchPins } from "@/src/workbench-client";

/** Project hub: tasks, goals, notes, files; demoted repos/chats links. */
export function ProjectDetailScreen({
  projectId,
}: {
  readonly projectId: string;
}) {
  const { chats, selectChat, setActiveProjectId } = useChats();
  const [workspace, setWorkspace] = useState<ProjectWorkspaceDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyIssueId, setBusyIssueId] = useState<string | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [linksExpanded, setLinksExpanded] = useState(false);
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
    void (async () => {
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
        setError(cause instanceof Error ? cause.message : "Could not save.");
      })
      .finally(() => setSaving(false));
  }, [dirty, instructions, name, projectId, saving, workspace]);

  const createProjectChat = useCallback(() => {
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
      });
  }, [projectId, selectChat, setActiveProjectId]);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      "Delete project?",
      "Files, goals, and notes on this project are removed. Chats keep their history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteProjectRequest(projectId)
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
      ],
    );
  }, [projectId]);

  const promptNewGoal = useCallback(() => {
    const create = (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      void createProjectGoalRequest(projectId, { title: trimmed })
        .then(() => reload())
        .catch((cause) => {
          setError(
            cause instanceof Error ? cause.message : "Could not create goal.",
          );
        });
    };
    if (Platform.OS === "ios") {
      Alert.prompt("New goal", undefined, (value) => create(value ?? ""), "plain-text");
      return;
    }
    Alert.alert("New goal", "Name the goal, then edit details from the list.", [
      {
        text: "Create “Untitled goal”",
        onPress: () => create("Untitled goal"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [projectId, reload]);

  const createNote = useCallback(() => {
    void createProjectNoteRequest(projectId, {
      title: "Untitled note",
      markdown: "",
    })
      .then((note) => {
        router.push(`/notes/${encodeURIComponent(note.id)}`);
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not create note.",
        );
      });
  }, [projectId]);

  const createFile = useCallback(() => {
    void createProjectFileRequest(projectId, {
      title: "Untitled",
      markdown: "# Untitled\n\n",
    })
      .then((artifact) => {
        router.push(
          `/workspaces/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(artifact.id)}`,
        );
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not create file.",
        );
      });
  }, [projectId]);

  const linkLibraryArtifact = useCallback(() => {
    setError(null);
    void listArtifacts()
      .then(({ artifacts }) => {
        const linked = new Set(
          (workspace?.artifacts ?? []).map((row) => row.pathname),
        );
        const available = artifacts.filter((row) => !linked.has(row.pathname));
        if (available.length === 0) {
          Alert.alert(
            "Nothing to link",
            linked.size > 0
              ? "All library items are already linked."
              : "Save something to Library first.",
          );
          return;
        }
        Alert.alert("Link from Library", undefined, [
          ...available.slice(0, 6).map((row) => ({
            text: row.basename,
            onPress: () => {
              void linkProjectArtifactRequest(projectId, row.pathname)
                .then(() => reload())
                .catch((cause) => {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not link artifact.",
                  );
                });
            },
          })),
          { text: "Cancel", style: "cancel" as const },
        ]);
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not load library.",
        );
      });
  }, [projectId, reload, workspace?.artifacts]);

  const linkExistingPin = useCallback(() => {
    void fetchWorkbenchPins()
      .then(({ pins }) => {
        const linkedIds = new Set((workspace?.pins ?? []).map((pin) => pin.id));
        const available = pins.filter((pin) => !linkedIds.has(pin.id));
        if (available.length === 0) {
          Alert.alert(
            "No pins to add",
            "Pin a repo in Workbench first, or add by owner/name.",
          );
          return;
        }
        Alert.alert("Link repo", undefined, [
          ...available.slice(0, 6).map((pin) => ({
            text: pin.fullName,
            onPress: () => {
              void linkProjectPinRequest(projectId, { pinId: pin.id })
                .then(() => reload())
                .catch((cause) => {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not link repo.",
                  );
                });
            },
          })),
          { text: "Cancel", style: "cancel" as const },
        ]);
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not load pins.",
        );
      });
  }, [projectId, reload, workspace?.pins]);

  const addRepoByName = useCallback(() => {
    if (Platform.OS === "ios") {
      Alert.prompt(
        "Add repo",
        "owner/name",
        (value) => {
          const trimmed = value?.trim() ?? "";
          const [owner, repoName] = trimmed.split("/");
          if (!owner || !repoName) {
            setError("Use owner/name, e.g. vercel/next.js");
            return;
          }
          void linkProjectPinRequest(projectId, {
            owner: owner.trim(),
            name: repoName.trim(),
            fullName: trimmed,
          })
            .then(() => reload())
            .catch((cause) => {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Could not add repo.",
              );
            });
        },
        "plain-text",
      );
      return;
    }
    Alert.alert("Add repo", "Link an existing Workbench pin.", [
      { text: "Pick pin", onPress: linkExistingPin },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [linkExistingPin, projectId, reload]);

  const attachExistingChat = useCallback(() => {
    const linkedIds = new Set((workspace?.chats ?? []).map((chat) => chat.id));
    const available = chats.filter(
      (chat) => chat.projectId !== projectId && !linkedIds.has(chat.id),
    );
    if (available.length === 0) {
      Alert.alert(
        "No chats to attach",
        "Start a new chat, or move one here from History.",
      );
      return;
    }
    Alert.alert("Attach chat", undefined, [
      ...available.slice(0, 6).map((chat) => ({
        text: chat.title || "Untitled",
        onPress: () => {
          void attachChatToProject(chat.id, projectId)
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
  }, [chats, projectId, reload, workspace?.chats]);

  const openPlusMenu = useCallback(() => {
    Alert.alert("New", undefined, [
      { text: "New task", onPress: () => setCreateTaskOpen(true) },
      { text: "New goal", onPress: promptNewGoal },
      { text: "New note", onPress: createNote },
      { text: "New file", onPress: createFile },
      { text: "Link library item", onPress: linkLibraryArtifact },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [createFile, createNote, linkLibraryArtifact, promptNewGoal]);

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

  const openLinksMenu = useCallback(() => {
    Alert.alert("Links", undefined, [
      { text: "New chat", onPress: createProjectChat },
      { text: "Attach chat", onPress: attachExistingChat },
      { text: "Link Workbench pin", onPress: linkExistingPin },
      { text: "Add repo by owner/name", onPress: addRepoByName },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [
    addRepoByName,
    attachExistingChat,
    createProjectChat,
    linkExistingPin,
  ]);

  const toggleGoal = useCallback(
    (goal: ProjectGoalDto) => {
      const next = goal.status === "done" ? "active" : "done";
      void updateProjectGoalRequest(projectId, goal.id, { status: next })
        .then((updated) => {
          setWorkspace((current) =>
            current
              ? {
                  ...current,
                  goals: current.goals.map((row) =>
                    row.id === updated.id ? updated : row,
                  ),
                }
              : current,
          );
        })
        .catch((cause) => {
          setError(
            cause instanceof Error ? cause.message : "Could not update goal.",
          );
        });
    },
    [projectId],
  );

  const resolveIssue = useCallback(
    async (issue: ProjectIssueDto, resolved: boolean) => {
      setBusyIssueId(issue.id);
      try {
        const updated = await setIssueResolvedRequest(issue.id, resolved);
        setWorkspace((current) =>
          current
            ? {
                ...current,
                issues: current.issues.map((row) =>
                  row.id === updated.id
                    ? {
                        ...row,
                        status: updated.status,
                        resolvedAt: updated.resolvedAt,
                        state: updated.state,
                      }
                    : row,
                ),
              }
            : current,
        );
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not update task.",
        );
      } finally {
        setBusyIssueId(null);
      }
    },
    [],
  );

  const deleteIssue = useCallback((issue: ProjectIssueDto) => {
    Alert.alert("Delete task?", issue.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteIssueRequest(issue.id)
            .then(() => {
              setWorkspace((current) =>
                current
                  ? {
                      ...current,
                      issues: current.issues.filter(
                        (row) => row.id !== issue.id,
                      ),
                    }
                  : current,
              );
            })
            .catch((cause) => {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Could not delete task.",
              );
            });
        },
      },
    ]);
  }, []);

  if (!workspace && !error) {
    return (
      <StackScreen>
        <Stack.Screen options={{ title: "Project" }} />
        <LoadingCenter />
      </StackScreen>
    );
  }

  const issues = workspace?.issues ?? [];
  const openIssues = issues.filter((row) => row.status === "open");
  const goals = workspace?.goals ?? [];
  const notes = workspace?.notes ?? [];
  const files = workspace?.artifacts ?? [];
  const pins = workspace?.pins ?? [];
  const projectChats = workspace?.chats ?? [];

  return (
    <StackScreen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: workspace?.project.name || "Project",
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: foregroundColor,
          headerRight:
            Platform.OS === "ios"
              ? undefined
              : () => (
                  <View className="flex-row items-center gap-1">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Add"
                      className="h-10 w-10 items-center justify-center"
                      onPress={openPlusMenu}
                    >
                      <Icon as={PlusIcon} className="size-5 text-foreground" />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="More"
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
            accessibilityLabel="Add"
            onPress={openPlusMenu}
          />
          <Stack.Toolbar.Button
            icon="ellipsis"
            accessibilityLabel="More"
            onPress={openOverflow}
          />
        </Stack.Toolbar>
      ) : null}
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-28 gap-6"
        contentContainerStyle={{ paddingTop: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <Pressable onPress={() => void reload()}>
            <Text className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error} · Tap to retry
            </Text>
          </Pressable>
        ) : null}

        <View className="flex-row items-start gap-3">
          <ProjectMark name={name || "P"} size="lg" />
          <View className="min-w-0 flex-1 gap-2">
            <TextInput
              className="text-xl font-semibold text-foreground"
              onBlur={saveIfDirty}
              onChangeText={setName}
              placeholder="Project name"
              placeholderTextColor={placeholderColor}
              value={name}
            />
            <TextInput
              className="min-h-16 text-sm text-foreground"
              multiline
              onBlur={saveIfDirty}
              onChangeText={setInstructions}
              placeholder="Instructions for every chat in this project"
              placeholderTextColor={placeholderColor}
              style={{ color: foregroundColor }}
              textAlignVertical="top"
              value={instructions}
            />
          </View>
        </View>

        <Section
          actionLabel="Add"
          onAction={() => setCreateTaskOpen(true)}
          title="Tasks"
        >
          {openIssues.length === 0 ? (
            <EmptyRow text="No open tasks." />
          ) : (
            openIssues.map((issue) => (
              <IssueRow
                busy={busyIssueId === issue.id}
                issue={issue}
                key={issue.id}
                onDelete={() => deleteIssue(issue)}
                onResolve={(resolved) => void resolveIssue(issue, resolved)}
              />
            ))
          )}
        </Section>

        <Section actionLabel="Add" onAction={promptNewGoal} title="Goals">
          {goals.length === 0 ? (
            <EmptyRow text="No goals yet." />
          ) : (
            goals.map((goal) => (
              <GoalRow
                goal={goal}
                key={goal.id}
                onDelete={() => {
                  Alert.alert("Delete goal?", goal.title, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => {
                        void deleteProjectGoalRequest(projectId, goal.id)
                          .then(() => reload())
                          .catch((cause) => {
                            setError(
                              cause instanceof Error
                                ? cause.message
                                : "Could not delete goal.",
                            );
                          });
                      },
                    },
                  ]);
                }}
                onToggle={() => toggleGoal(goal)}
              />
            ))
          )}
        </Section>

        <Section actionLabel="Add" onAction={createNote} title="Notes">
          {notes.length === 0 ? (
            <EmptyRow text="No notes yet." />
          ) : (
            notes.map((note) => (
              <LinkRow
                key={note.id}
                onPress={() =>
                  router.push(
                    `/notes/${encodeURIComponent(note.id)}`,
                  )
                }
                subtitle={new Date(note.updatedAt).toLocaleDateString()}
                title={note.title}
              />
            ))
          )}
        </Section>

        <Section
          actionLabel="Add"
          onAction={() => {
            Alert.alert("Files", undefined, [
              { text: "New markdown file", onPress: createFile },
              { text: "Link from Library", onPress: linkLibraryArtifact },
              { text: "Cancel", style: "cancel" },
            ]);
          }}
          title="Files"
        >
          {files.length === 0 ? (
            <EmptyRow text="No files yet." />
          ) : (
            files.map((file) => (
              <LinkRow
                key={file.id}
                onLongPress={() => {
                  Alert.alert("Unlink file?", file.title, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Unlink",
                      style: "destructive",
                      onPress: () => {
                        void unlinkProjectArtifactRequest(projectId, file.id)
                          .then(() => reload())
                          .catch((cause) => {
                            setError(
                              cause instanceof Error
                                ? cause.message
                                : "Could not unlink.",
                            );
                          });
                      },
                    },
                  ]);
                }}
                onPress={() =>
                  router.push(
                    `/workspaces/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(file.id)}`,
                  )
                }
                subtitle={file.pathname.split("/").pop() ?? file.pathname}
                title={file.title}
              />
            ))
          )}
        </Section>

        <View className="gap-2">
          <Pressable
            accessibilityRole="button"
            className="flex-row items-center justify-between py-1"
            onPress={() => setLinksExpanded((value) => !value)}
            onLongPress={openLinksMenu}
          >
            <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Links · {pins.length} repos · {projectChats.length} chats
            </Text>
            <Text className="text-xs text-muted-foreground">
              {linksExpanded ? "Hide" : "Show"}
            </Text>
          </Pressable>
          {linksExpanded ? (
            <View className="gap-3">
              <View>
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="text-sm font-medium text-foreground">
                    Repos
                  </Text>
                  <Pressable onPress={openLinksMenu}>
                    <Text className="text-sm text-muted-foreground">Manage</Text>
                  </Pressable>
                </View>
                {pins.length === 0 ? (
                  <EmptyRow text="No repos linked." />
                ) : (
                  pins.map((pin) => (
                    <LinkRow
                      key={pin.id}
                      onLongPress={() => {
                        Alert.alert("Unlink repo?", pin.fullName, [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Unlink",
                            style: "destructive",
                            onPress: () => {
                              void unlinkProjectPinRequest(projectId, pin.id)
                                .then(() => reload())
                                .catch((cause) => {
                                  setError(
                                    cause instanceof Error
                                      ? cause.message
                                      : "Could not unlink.",
                                  );
                                });
                            },
                          },
                        ]);
                      }}
                      onPress={() =>
                        router.push(
                          `/workbench/${encodeURIComponent(pin.id)}`,
                        )
                      }
                      title={pin.fullName}
                    />
                  ))
                )}
              </View>
              <View>
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="text-sm font-medium text-foreground">
                    Chats
                  </Text>
                  <Pressable onPress={createProjectChat}>
                    <Text className="text-sm text-muted-foreground">New</Text>
                  </Pressable>
                </View>
                {projectChats.length === 0 ? (
                  <EmptyRow text="No chats yet." />
                ) : (
                  projectChats.map((chat) => (
                    <LinkRow
                      key={chat.id}
                      onPress={() => {
                        setActiveProjectId(projectId);
                        revealChatThread();
                        void selectChat(chat.id);
                      }}
                      title={chat.title || "Untitled"}
                    />
                  ))
                )}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <CreateTaskModal
        onClose={() => setCreateTaskOpen(false)}
        onCreated={() => {
          setCreateTaskOpen(false);
          void reload();
        }}
        open={createTaskOpen}
        projectId={projectId}
      />
    </StackScreen>
  );
}

function Section({
  title,
  actionLabel,
  onAction,
  children,
}: {
  readonly title: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
  readonly children: ReactNode;
}) {
  return (
    <View className="gap-1">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </Text>
        <Pressable onPress={onAction}>
          <Text className="text-sm text-muted-foreground">{actionLabel}</Text>
        </Pressable>
      </View>
      <View className="overflow-hidden rounded-xl border border-border/40">
        {children}
      </View>
    </View>
  );
}

function EmptyRow({ text }: { readonly text: string }) {
  return (
    <Text className="px-3 py-4 text-sm text-muted-foreground">{text}</Text>
  );
}

function LinkRow({
  title,
  subtitle,
  onPress,
  onLongPress,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
}) {
  return (
    <Pressable
      className="min-h-11 justify-center border-b border-border/40 px-3 py-3 last:border-b-0"
      onLongPress={onLongPress}
      onPress={onPress}
    >
      <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

function IssueRow({
  issue,
  busy,
  onResolve,
  onDelete,
}: {
  readonly issue: ProjectIssueDto;
  readonly busy: boolean;
  readonly onResolve: (resolved: boolean) => void;
  readonly onDelete: () => void;
}) {
  const resolved = issue.status === "resolved";
  return (
    <View className="flex-row items-center gap-3 border-b border-border/40 px-3 py-3 last:border-b-0">
      <Pressable
        accessibilityLabel={resolved ? "Reopen" : "Complete"}
        className={cn(
          "h-7 w-7 items-center justify-center rounded-full border",
          resolved ? "border-border bg-muted" : "border-foreground/30",
        )}
        disabled={busy}
        onPress={() => onResolve(!resolved)}
      >
        {resolved ? (
          <Icon as={CheckIcon} className="size-4 text-foreground" />
        ) : null}
      </Pressable>
      <Pressable
        className="min-w-0 flex-1"
        onLongPress={onDelete}
        onPress={() => router.push(`/tasks/${encodeURIComponent(issue.id)}`)}
      >
        <Text className="text-sm text-foreground" numberOfLines={2}>
          {issue.title}
        </Text>
      </Pressable>
    </View>
  );
}

function GoalRow({
  goal,
  onToggle,
  onDelete,
}: {
  readonly goal: ProjectGoalDto;
  readonly onToggle: () => void;
  readonly onDelete: () => void;
}) {
  const done = goal.status === "done";
  return (
    <View className="flex-row items-center gap-3 border-b border-border/40 px-3 py-3 last:border-b-0">
      <Pressable
        accessibilityLabel={done ? "Mark active" : "Mark done"}
        className={cn(
          "h-7 w-7 items-center justify-center rounded-full border",
          done ? "border-border bg-muted" : "border-foreground/30",
        )}
        onPress={onToggle}
      >
        {done ? (
          <Icon as={CheckIcon} className="size-4 text-foreground" />
        ) : null}
      </Pressable>
      <Pressable className="min-w-0 flex-1" onLongPress={onDelete}>
        <Text
          className={cn(
            "text-sm text-foreground",
            done ? "line-through text-muted-foreground" : undefined,
          )}
          numberOfLines={2}
        >
          {goal.title}
        </Text>
        {goal.targetDate ? (
          <Text className="mt-0.5 text-xs text-muted-foreground">
            Target {goal.targetDate}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}
