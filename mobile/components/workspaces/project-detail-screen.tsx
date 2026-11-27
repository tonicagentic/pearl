import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  CheckIcon,
  MoreHorizontalIcon,
  PlusIcon,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { revealChatThread } from "@/components/chat-history-push";
import {
  ScreenChrome,
  type ScreenChromeAction,
} from "@/components/navigation/screen-chrome";
import {
  DRAWER_EDGE,
  DrawerChatRow,
} from "@/components/navigation/drawer-rows";
import { ProjectMark } from "@/components/project-mark";
import { CreateTaskModal } from "@/components/tasks/create-task-modal";
import { TaskDateField } from "@/components/tasks/task-date-field";
import { Icon } from "@/components/ui/icon";
import { LoadingCenter } from "@/components/ui/loading-center";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { listArtifacts } from "@/src/artifacts-client";
import { usePearlDrawerOptional } from "@/components/navigation/drawer-context";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import {
  attachChatToProject,
  type ChatListItem,
} from "@/src/chats-client";
import { updateGoalRequest } from "@/src/goals-client";
import { KeyboardStickyView } from "@/src/keyboard-controller";
import {
  usePearlCardBackground,
  usePearlHairlineBorder,
} from "@/src/navigation-theme";
import { startGoalChat } from "@/src/start-goal-chat";
import {
  deleteIssueRequest,
  setIssueResolvedRequest,
} from "@/src/issues-client";
import { createNoteRequest } from "@/src/notes-client";
import { openWebUrl } from "@/src/open-web-url";
import { ProjectLabelChip } from "@/components/workspaces/project-label-chip";
import {
  createProjectFileRequest,
  createProjectLabelRequest,
  createProjectLinkRequest,
  deleteProjectGoalRequest,
  deleteProjectLinkRequest,
  deleteProjectRequest,
  fetchProjectLabels,
  fetchProjectWorkspace,
  linkProjectArtifactRequest,
  linkProjectPinRequest,
  setProjectLabelsRequest,
  unlinkProjectArtifactRequest,
  unlinkProjectPinRequest,
  updateProjectLinkRequest,
  updateProjectRequest,
  type ProjectGoalDto,
  type ProjectIssueDto,
  type ProjectLabelDto,
  type ProjectLinkDto,
  type ProjectPriority,
  type ProjectStatus,
  type ProjectWorkspaceDto,
} from "@/src/projects-client";
import {
  projectChromeLeading,
  type ProjectEntryFrom,
} from "@/src/overview-ui";
import { queryKeys } from "@/src/query-client";
import { fetchWorkbenchPins } from "@/src/workbench-client";

export type { ProjectEntryFrom };

type ProjectTab = "chats" | "sources";

const PROJECT_TABS: readonly {
  readonly key: ProjectTab;
  readonly label: string;
}[] = [
  { key: "chats", label: "Chats" },
  { key: "sources", label: "Sources" },
];

const MESSAGE_DOCK_HEIGHT = 52;
/** List padding so the last chat row clears the floating Message dock. */
const MESSAGE_DOCK_CLEARANCE = MESSAGE_DOCK_HEIGHT + 28;

const STATUS_OPTIONS: readonly {
  readonly value: ProjectStatus;
  readonly label: string;
}[] = [
  { value: "backlog", label: "Backlog" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
];

const PRIORITY_OPTIONS: readonly {
  readonly value: ProjectPriority;
  readonly label: string;
}[] = [
  { value: "none", label: "No priority" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function statusLabel(status: ProjectStatus): string {
  return STATUS_OPTIONS.find((row) => row.value === status)?.label ?? status;
}

function priorityLabel(priority: ProjectPriority): string {
  return (
    PRIORITY_OPTIONS.find((row) => row.value === priority)?.label ?? priority
  );
}

function formatDatePill(start: string | null, target: string | null): string {
  const startText = start
    ? new Date(`${start}T12:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "No start";
  const targetText = target
    ? new Date(`${target}T12:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "No target date";
  return `${startText} → ${targetText}`;
}

/** Project hub: chats first, sources for instructions and linked work. */
export function ProjectDetailScreen({
  projectId,
  entryFrom,
}: {
  readonly projectId: string;
  /** Where the user opened this project from — drives the back affordance. */
  readonly entryFrom?: ProjectEntryFrom;
}) {
  const queryClient = useQueryClient();
  const {
    chats,
    activeChatId,
    selectChat,
    setActiveProjectId,
    startNewChatWithMessage,
  } = useChats();
  const { isAnonymous } = useAuth();
  const drawer = usePearlDrawerOptional();
  const [workspace, setWorkspace] = useState<ProjectWorkspaceDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyIssueId, setBusyIssueId] = useState<string | null>(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [tab, setTab] = useState<ProjectTab>("chats");
  const [draftMessage, setDraftMessage] = useState("");
  const [datesOpen, setDatesOpen] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftTargetDate, setDraftTargetDate] = useState("");
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const borderColor = useCSSVariable("--color-border") as string | undefined;
  const mutedDot = borderColor ?? "#3A3A3C";

  /**
   * Drawer-style rows. Membership comes from workspace.chats (already excludes
   * custom-agent threads); enrich with live presence from the global list.
   */
  const projectChatRows = useMemo((): readonly ChatListItem[] => {
    const liveById = new Map(
      chats
        .filter((chat) => chat.projectId === projectId)
        .map((chat) => [chat.id, chat] as const),
    );
    const rows: ChatListItem[] = [];
    for (const row of workspace?.chats ?? []) {
      const live = liveById.get(row.id);
      rows.push(
        live ?? {
          id: row.id,
          title: row.title || "Untitled",
          updatedAt: row.updatedAt,
          projectId,
          waitingForInput: false,
          presence: "idle",
        },
      );
    }
    return rows.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [chats, projectId, workspace?.chats]);

  const applyWorkspace = useCallback(
    (data: ProjectWorkspaceDto) => {
      const headerDirty =
        workspace !== null &&
        (name.trim() !== workspace.project.name ||
          instructions !== workspace.project.instructions);
      if (headerDirty && workspace) {
        setWorkspace({ ...data, project: workspace.project });
      } else {
        setWorkspace(data);
        setName(data.project.name);
        setInstructions(data.project.instructions);
      }
    },
    [instructions, name, workspace],
  );

  const invalidateProject = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.project(projectId),
    });
  }, [projectId, queryClient]);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchProjectWorkspace(projectId);
      applyWorkspace(data);
      invalidateProject();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to load project.",
      );
    }
  }, [applyWorkspace, invalidateProject, projectId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchProjectWorkspace(projectId);
        if (!cancelled) {
          applyWorkspace(data);
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
  }, [applyWorkspace, projectId]);

  const dirty =
    workspace !== null &&
    (name.trim() !== workspace.project.name ||
      instructions !== workspace.project.instructions);

  const saveIfDirty = useCallback(() => {
    if (!workspace || !dirty || saving || !name.trim()) return;
    setSaving(true);
    setError(null);
    const sentName = name.trim();
    const sentInstructions = instructions;
    void updateProjectRequest(projectId, {
      name: sentName,
      instructions: sentInstructions,
    })
      .then((project) => {
        setWorkspace((current) =>
          current ? { ...current, project } : current,
        );
        invalidateProject();
        const draftUnchanged =
          name.trim() === sentName && instructions === sentInstructions;
        if (draftUnchanged) {
          setName(project.name);
          setInstructions(project.instructions);
        }
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Could not save.");
      })
      .finally(() => setSaving(false));
  }, [dirty, instructions, invalidateProject, name, projectId, saving, workspace]);

  const sendProjectMessage = useCallback(() => {
    const text = draftMessage.trim();
    if (!text) return;
    if (isAnonymous) {
      router.push("/sign-in");
      return;
    }
    setDraftMessage("");
    // newChat clears the attached project, so re-attach after seeding.
    startNewChatWithMessage(text);
    setActiveProjectId(projectId);
    revealChatThread({ returnProjectId: projectId, entryFrom });
  }, [
    draftMessage,
    entryFrom,
    isAnonymous,
    projectId,
    setActiveProjectId,
    startNewChatWithMessage,
  ]);

  /** Drawer entry uses the menu control; stack entries use system back. */
  const chromeLeading = projectChromeLeading(entryFrom);

  const leaveProject = useCallback(() => {
    if (entryFrom === "overview") {
      drawer?.notifyChatSelectedFromDrawer({ tab: "track" });
      if (router.canGoBack()) {
        router.back();
      } else {
        router.navigate("/");
      }
      return;
    }
    if (entryFrom === "drawer") {
      router.navigate("/");
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/workspaces");
  }, [drawer, entryFrom]);

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
                leaveProject();
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
  }, [leaveProject, projectId]);

  const promptNewGoal = useCallback(() => {
    startGoalChat({
      isAnonymous,
      startNewChatWithMessage,
      notifyChatSelectedFromDrawer:
        drawer?.notifyChatSelectedFromDrawer ?? (() => {}),
      setActiveProjectId,
      projectId,
    });
  }, [
    drawer?.notifyChatSelectedFromDrawer,
    isAnonymous,
    projectId,
    setActiveProjectId,
    startNewChatWithMessage,
  ]);

  const createNote = useCallback(() => {
    void createNoteRequest({
      title: "Untitled note",
      markdown: "",
      projectId,
    })
      .then((note) => {
        invalidateProject();
        router.push(`/notes/${encodeURIComponent(note.id)}`);
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not create note.",
        );
      });
  }, [invalidateProject, projectId]);

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

  const toggleGoal = useCallback(
    (goal: ProjectGoalDto) => {
      const next = goal.status === "done" ? "active" : "done";
      void updateGoalRequest(goal.id, { status: next })
        .then((updated) => {
          invalidateProject();
          setWorkspace((current) =>
            current
              ? {
                  ...current,
                  goals: current.goals.map((row) =>
                    row.id === updated.id ? { ...row, ...updated } : row,
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
    [invalidateProject],
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

  const chromeActions = useMemo((): readonly ScreenChromeAction[] => {
    if (!workspace && !error) return [];
    return [
      {
        label: "Add",
        systemImage: "plus",
        icon: PlusIcon,
        onPress: openPlusMenu,
      },
      {
        label: "More",
        systemImage: "ellipsis",
        icon: MoreHorizontalIcon,
        onPress: openOverflow,
      },
    ];
  }, [error, openOverflow, openPlusMenu, workspace]);

  const patchProjectFields = useCallback(
    (
      input: {
        readonly status?: ProjectStatus;
        readonly priority?: ProjectPriority;
        readonly startDate?: string | null;
        readonly targetDate?: string | null;
      },
    ) => {
      setError(null);
      void updateProjectRequest(projectId, input)
        .then((project) => {
          setWorkspace((current) =>
            current ? { ...current, project } : current,
          );
          invalidateProject();
        })
        .catch((cause) => {
          setError(
            cause instanceof Error ? cause.message : "Could not save.",
          );
        });
    },
    [invalidateProject, projectId],
  );

  const pickStatus = useCallback(() => {
    Alert.alert("Status", undefined, [
      ...STATUS_OPTIONS.map((option) => ({
        text: option.label,
        onPress: () => patchProjectFields({ status: option.value }),
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }, [patchProjectFields]);

  const pickPriority = useCallback(() => {
    Alert.alert("Priority", undefined, [
      ...PRIORITY_OPTIONS.map((option) => ({
        text: option.label,
        onPress: () => patchProjectFields({ priority: option.value }),
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }, [patchProjectFields]);

  const applyLabels = useCallback(
    (labels: readonly ProjectLabelDto[]) => {
      setWorkspace((current) =>
        current
          ? { ...current, project: { ...current.project, labels } }
          : current,
      );
      invalidateProject();
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
    [invalidateProject, queryClient],
  );

  const pickLabels = useCallback(() => {
    const assigned = workspace?.project.labels ?? [];
    const assignedIds = new Set(assigned.map((label) => label.id));

    const createNew = () => {
      Alert.prompt(
        "New label",
        "Name for this label",
        (name) => {
          const trimmed = name?.trim() ?? "";
          if (!trimmed) return;
          void createProjectLabelRequest({ name: trimmed, color: "blue" })
            .then((label) =>
              setProjectLabelsRequest(projectId, { addLabelId: label.id }),
            )
            .then(applyLabels)
            .catch((cause) => {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Could not create label.",
              );
            });
        },
        "plain-text",
      );
    };

    void fetchProjectLabels()
      .then((catalog) => {
        const available = catalog.filter((label) => !assignedIds.has(label.id));
        Alert.alert("Labels", undefined, [
          ...assigned.map((label) => ({
            text: `Remove “${label.name}”`,
            style: "destructive" as const,
            onPress: () => {
              void setProjectLabelsRequest(projectId, {
                removeLabelId: label.id,
              })
                .then(applyLabels)
                .catch((cause) => {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not remove label.",
                  );
                });
            },
          })),
          ...available.slice(0, 6).map((label) => ({
            text: label.name,
            onPress: () => {
              void setProjectLabelsRequest(projectId, {
                addLabelId: label.id,
              })
                .then(applyLabels)
                .catch((cause) => {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not add label.",
                  );
                });
            },
          })),
          { text: "Create label", onPress: createNew },
          { text: "Cancel", style: "cancel" as const },
        ]);
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not load labels.",
        );
      });
  }, [applyLabels, projectId, workspace?.project.labels]);

  const openDatesSheet = useCallback(() => {
    setDraftStartDate(workspace?.project.startDate ?? "");
    setDraftTargetDate(workspace?.project.targetDate ?? "");
    setDatesOpen(true);
  }, [workspace?.project.startDate, workspace?.project.targetDate]);

  const saveDatesSheet = useCallback(() => {
    setDatesOpen(false);
    patchProjectFields({
      startDate: draftStartDate || null,
      targetDate: draftTargetDate || null,
    });
  }, [draftStartDate, draftTargetDate, patchProjectFields]);

  const promptAddUrl = useCallback(() => {
    const create = (title: string, url: string) => {
      const trimmedTitle = title.trim() || "Link";
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        setError("A link needs a URL.");
        return;
      }
      void createProjectLinkRequest(projectId, {
        title: trimmedTitle,
        url: trimmedUrl,
      })
        .then(() => reload())
        .catch((cause) => {
          setError(
            cause instanceof Error ? cause.message : "Could not add link.",
          );
        });
    };

    if (Platform.OS === "ios") {
      Alert.prompt("Link title", undefined, (titleValue) => {
        const title = titleValue?.trim() || "Link";
        Alert.prompt("URL", "https://…", (urlValue) => {
          create(title, urlValue ?? "");
        }, "plain-text");
      }, "plain-text");
      return;
    }
    Alert.alert("Add URL", "Enter an https URL to attach.", [
      {
        text: "Add example.com",
        onPress: () => create("Link", "https://example.com"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [projectId, reload]);

  const editUrlLink = useCallback(
    (link: ProjectLinkDto) => {
      Alert.alert(link.title, link.url, [
        {
          text: "Edit title",
          onPress: () => {
            if (Platform.OS === "ios") {
              Alert.prompt(
                "Title",
                undefined,
                (value) => {
                  const title = value?.trim();
                  if (!title) return;
                  void updateProjectLinkRequest(projectId, link.id, { title })
                    .then(() => reload())
                    .catch((cause) => {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not update link.",
                      );
                    });
                },
                "plain-text",
                link.title,
              );
              return;
            }
            Alert.alert("Edit on iOS", "Title editing uses the prompt sheet.");
          },
        },
        {
          text: "Edit URL",
          onPress: () => {
            if (Platform.OS === "ios") {
              Alert.prompt(
                "URL",
                undefined,
                (value) => {
                  const url = value?.trim();
                  if (!url) return;
                  void updateProjectLinkRequest(projectId, link.id, { url })
                    .then(() => reload())
                    .catch((cause) => {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not update link.",
                      );
                    });
                },
                "plain-text",
                link.url,
              );
              return;
            }
            Alert.alert("Edit on iOS", "URL editing uses the prompt sheet.");
          },
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteProjectLinkRequest(projectId, link.id)
              .then(() => reload())
              .catch((cause) => {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Could not delete link.",
                );
              });
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [projectId, reload],
  );

  const openResourcesMenu = useCallback(() => {
    Alert.alert("Add resource", undefined, [
      { text: "New file", onPress: createFile },
      { text: "Link from Library", onPress: linkLibraryArtifact },
      { text: "Add URL", onPress: promptAddUrl },
      {
        text: "Link repo",
        onPress: () => {
          Alert.alert("Link repo", undefined, [
            { text: "Link Workbench pin", onPress: linkExistingPin },
            { text: "Add repo by owner/name", onPress: addRepoByName },
            { text: "Cancel", style: "cancel" },
          ]);
        },
      },
      { text: "Attach chat", onPress: attachExistingChat },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [
    addRepoByName,
    attachExistingChat,
    createFile,
    linkExistingPin,
    linkLibraryArtifact,
    promptAddUrl,
  ]);

  if (!workspace && !error) {
    return (
      <ScreenChrome
        title="Project"
        leading={chromeLeading}
        contentPaddingTop={0}
      >
        <LoadingCenter />
      </ScreenChrome>
    );
  }

  const issues = workspace?.issues ?? [];
  const openIssues = issues.filter((row) => row.status === "open");
  const goals = workspace?.goals ?? [];
  const notes = workspace?.notes ?? [];
  const files = workspace?.artifacts ?? [];
  const pins = workspace?.pins ?? [];
  const links = workspace?.links ?? [];
  const projectStatus = workspace?.project.status ?? "backlog";
  const projectPriority = workspace?.project.priority ?? "none";
  const projectStartDate = workspace?.project.startDate ?? null;
  const projectTargetDate = workspace?.project.targetDate ?? null;
  const hasResources =
    files.length > 0 || links.length > 0 || pins.length > 0;

  const projectLabel = name.trim() || "project";
  const messagePlaceholder = `Message ${
    projectLabel.length > 28
      ? `${projectLabel.slice(0, 27)}…`
      : projectLabel
  }`;

  return (
    <ScreenChrome
      title={workspace?.project.name || "Project"}
      leading={chromeLeading}
      contentPaddingTop={0}
      actions={chromeActions}
    >
      <View className="flex-1">
        <View className="gap-3 px-5 pt-3">
          {error ? (
            <Pressable onPress={() => void reload()}>
              <Text className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error} · Tap to retry
              </Text>
            </Pressable>
          ) : null}

          <View className="flex-row items-center gap-3">
            <ProjectMark name={name || "P"} size="lg" />
            <TextInput
              className="min-w-0 flex-1 text-xl font-semibold text-foreground"
              onBlur={saveIfDirty}
              onChangeText={setName}
              placeholder="Project name"
              placeholderTextColor={placeholderColor}
              value={name}
            />
          </View>

          <View className="flex-row flex-wrap gap-1.5">
            <PropertyPill
              label={statusLabel(projectStatus)}
              onPress={pickStatus}
            />
            <PropertyPill
              label={priorityLabel(projectPriority)}
              onPress={pickPriority}
            />
            <PropertyPill
              label={formatDatePill(projectStartDate, projectTargetDate)}
              onPress={openDatesSheet}
            />
            <PropertyPill
              label={
                (workspace?.project.labels?.length ?? 0) > 0
                  ? `Labels · ${String(workspace?.project.labels.length)}`
                  : "Labels"
              }
              onPress={pickLabels}
            />
          </View>
          {(workspace?.project.labels?.length ?? 0) > 0 ? (
            <View className="flex-row flex-wrap gap-1.5">
              {workspace!.project.labels.map((label) => (
                <ProjectLabelChip key={label.id} label={label} />
              ))}
            </View>
          ) : null}

          <View className="flex-row gap-1.5 pb-1">
            {PROJECT_TABS.map(({ key, label }) => {
              const selected = tab === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={cn(
                    "rounded-full px-3 py-1.5",
                    selected
                      ? "border border-border/50 bg-muted"
                      : "border border-transparent",
                  )}
                  onPress={() => setTab(key)}
                >
                  <Text
                    className={cn(
                      "text-sm font-medium",
                      selected ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName={cn(
            "gap-3",
            tab === "chats" ? undefined : "px-5 pb-10",
          )}
          contentContainerStyle={{
            paddingTop: 12,
            paddingBottom: tab === "chats" ? MESSAGE_DOCK_CLEARANCE : undefined,
            paddingHorizontal: tab === "chats" ? DRAWER_EDGE : undefined,
          }}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          {tab === "chats" ? (
            projectChatRows.length === 0 ? (
              <Text className="px-3 py-4 text-sm text-muted-foreground">
                No chats yet.
              </Text>
            ) : (
              projectChatRows.map((chat) => (
                <DrawerChatRow
                  key={chat.id}
                  chat={chat}
                  mutedDot={mutedDot}
                  selected={activeChatId === chat.id}
                  onPress={() => {
                    setActiveProjectId(projectId);
                    revealChatThread({
                      returnProjectId: projectId,
                      entryFrom,
                    });
                    void selectChat(chat.id);
                  }}
                />
              ))
            )
          ) : null}

          {tab === "sources" ? (
            <View className="gap-6">
              <View className="gap-2">
                <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Instructions
                </Text>
                <TextInput
                  className="min-h-28 text-sm text-foreground"
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

              <View className="gap-2">
                <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sandbox
                </Text>
                <View className="overflow-hidden rounded-xl border border-border/40">
                  {workspace?.project.driveName ? (
                    <View className="min-h-11 justify-center px-3 py-3">
                      <Text
                        className="text-sm font-medium text-foreground"
                        numberOfLines={1}
                      >
                        Project workspace
                      </Text>
                      <Text
                        className="mt-0.5 text-xs text-muted-foreground"
                        numberOfLines={2}
                      >
                        Shared across every chat in this project
                      </Text>
                    </View>
                  ) : (
                    <EmptyRow text="Shared files appear when Pearl uses this project’s workspace" />
                  )}
                </View>
              </View>

              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Resources
                  </Text>
                  <Pressable onPress={openResourcesMenu}>
                    <Text className="text-sm text-muted-foreground">
                      + Add…
                    </Text>
                  </Pressable>
                </View>
                <View className="overflow-hidden rounded-xl border border-border/40">
                  {!hasResources ? (
                    <EmptyRow text="No files, links, or repos yet." />
                  ) : (
                    <>
                      {files.map((file) => (
                        <LinkRow
                          key={`file-${file.id}`}
                          onLongPress={() => {
                            Alert.alert("Unlink file?", file.title, [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Unlink",
                                style: "destructive",
                                onPress: () => {
                                  void unlinkProjectArtifactRequest(
                                    projectId,
                                    file.id,
                                  )
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
                          subtitle={
                            file.pathname.split("/").pop() ?? file.pathname
                          }
                          title={file.title}
                        />
                      ))}
                      {links.map((link) => (
                        <LinkRow
                          key={`link-${link.id}`}
                          onLongPress={() => editUrlLink(link)}
                          onPress={() => openWebUrl(link.url)}
                          subtitle={link.url}
                          title={link.title}
                        />
                      ))}
                      {pins.map((pin) => (
                        <LinkRow
                          key={`pin-${pin.id}`}
                          onLongPress={() => {
                            Alert.alert("Unlink repo?", pin.fullName, [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Unlink",
                                style: "destructive",
                                onPress: () => {
                                  void unlinkProjectPinRequest(
                                    projectId,
                                    pin.id,
                                  )
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
                      ))}
                    </>
                  )}
                </View>
              </View>

              <SourceSection
                title="Tasks"
                onAdd={() => setCreateTaskOpen(true)}
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
                      onResolve={(resolved) =>
                        void resolveIssue(issue, resolved)
                      }
                    />
                  ))
                )}
              </SourceSection>

              <SourceSection title="Goals" onAdd={promptNewGoal}>
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
              </SourceSection>

              <SourceSection title="Notes" onAdd={createNote}>
                {notes.length === 0 ? (
                  <EmptyRow text="No notes yet." />
                ) : (
                  notes.map((note) => (
                    <LinkRow
                      key={note.id}
                      onPress={() =>
                        router.push(`/notes/${encodeURIComponent(note.id)}`)
                      }
                      subtitle={new Date(note.updatedAt).toLocaleDateString()}
                      title={note.title}
                    />
                  ))
                )}
              </SourceSection>
            </View>
          ) : null}
        </ScrollView>

        {tab === "chats" ? (
          <ProjectMessageDock
            onChangeText={setDraftMessage}
            onSubmit={sendProjectMessage}
            placeholder={messagePlaceholder}
            value={draftMessage}
          />
        ) : null}
      </View>

      <CreateTaskModal
        onClose={() => setCreateTaskOpen(false)}
        onCreated={() => {
          setCreateTaskOpen(false);
          void reload();
        }}
        open={createTaskOpen}
        projectId={projectId}
      />

      <Modal
        visible={datesOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDatesOpen(false)}
      >
        <View className="flex-1 justify-end bg-foreground/40">
          <View
            style={{ backgroundColor }}
            className="gap-3 rounded-t-3xl px-4 pb-8 pt-4"
          >
            <Text className="text-base font-semibold text-foreground">
              Project dates
            </Text>
            <View className="flex-row gap-3">
              <TaskDateField
                label="Start"
                onChange={setDraftStartDate}
                value={draftStartDate}
              />
              <TaskDateField
                label="Target"
                onChange={setDraftTargetDate}
                value={draftTargetDate}
              />
            </View>
            <View className="mt-1 flex-row justify-between">
              <Pressable
                accessibilityRole="button"
                className="min-h-11 justify-center px-2"
                onPress={() => {
                  setDraftStartDate("");
                  setDraftTargetDate("");
                }}
              >
                <Text className="text-foreground">Clear</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                className="min-h-11 justify-center px-2"
                onPress={saveDatesSheet}
              >
                <Text className="font-medium text-foreground">Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenChrome>
  );
}

function PropertyPill({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="rounded-full border border-border/50 bg-muted px-3 py-1.5"
      onPress={onPress}
    >
      <Text className="text-sm font-medium text-foreground">{label}</Text>
    </Pressable>
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
        <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </Text>
        <Pressable onPress={onAdd}>
          <Text className="text-sm text-muted-foreground">{addLabel}</Text>
        </Pressable>
      </View>
      <View className="overflow-hidden rounded-xl border border-border/40">
        {children}
      </View>
    </View>
  );
}

/** One-line “Message {project}” dock; submit opens a seeded project chat. */
function ProjectMessageDock({
  value,
  onChangeText,
  onSubmit,
  placeholder,
}: {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly onSubmit: () => void;
  readonly placeholder: string;
}) {
  const insets = useSafeAreaInsets();
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const cardColor = usePearlCardBackground();
  const hairline = usePearlHairlineBorder();

  return (
    <KeyboardStickyView
      offset={{ closed: 0, opened: 0 }}
      style={[
        messageDockStyles.sticky,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <View
        style={[
          messageDockStyles.pill,
          {
            backgroundColor: cardColor,
            borderColor: hairline,
          },
        ]}
      >
        <TextInput
          accessibilityLabel={placeholder}
          enablesReturnKeyAutomatically
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          returnKeyType="send"
          blurOnSubmit
          style={[messageDockStyles.input, { color: foregroundColor }]}
          value={value}
        />
      </View>
    </KeyboardStickyView>
  );
}

const messageDockStyles = StyleSheet.create({
  sticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 20,
  },
  pill: {
    height: MESSAGE_DOCK_HEIGHT,
    borderRadius: MESSAGE_DOCK_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  input: {
    fontSize: 17,
    paddingVertical: 0,
  },
});

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
      <Pressable
        className="min-w-0 flex-1"
        onLongPress={onDelete}
        onPress={() =>
          router.push(`/goals/${encodeURIComponent(goal.id)}`)
        }
      >
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
