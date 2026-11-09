import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";
import {
  createIssueRequest,
  deleteIssueRequest,
  fetchIssues,
  setIssueResolvedRequest,
  updateIssueRequest,
  type IssueDto,
  type IssuesPayload,
} from "@/src/issues-client";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateList() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

/**
 * Tasks inbox: elegant native list with opportunistic CRUD against /api/issues.
 * New tasks default to the Inbox area (areas stay in the DB, not the UI).
 */
export function IssuesScreen() {
  const [payload, setPayload] = useState<IssuesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<IssueDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const reload = useCallback(async () => {
    try {
      setError(null);
      setPayload(await fetchIssues());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load tasks.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchIssues();
        if (!cancelled) {
          setPayload(data);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Failed to load tasks.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const patchIssue = useCallback((updated: IssueDto) => {
    animateList();
    setPayload((current) =>
      current
        ? {
            ...current,
            issues: current.issues.map((row) =>
              row.id === updated.id ? { ...row, ...updated } : row,
            ),
          }
        : current,
    );
  }, []);

  const removeIssue = useCallback((id: string) => {
    animateList();
    setPayload((current) =>
      current
        ? {
            ...current,
            issues: current.issues.filter((row) => row.id !== id),
          }
        : current,
    );
  }, []);

  const setResolved = useCallback(
    async (issue: IssueDto, resolved: boolean) => {
      setBusyId(issue.id);
      const optimistic: IssueDto = {
        ...issue,
        status: resolved ? "resolved" : "open",
        state: resolved ? "resolved" : "active",
        resolvedAt: resolved ? new Date().toISOString() : null,
      };
      patchIssue(optimistic);
      try {
        const updated = await setIssueResolvedRequest(issue.id, resolved);
        patchIssue(updated);
      } catch (cause) {
        patchIssue(issue);
        setError(
          cause instanceof Error ? cause.message : "Failed to update the task.",
        );
      } finally {
        setBusyId(null);
      }
    },
    [patchIssue],
  );

  const deleteTask = useCallback(
    (issue: IssueDto) => {
      Alert.alert("Delete task?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusyId(issue.id);
              removeIssue(issue.id);
              try {
                await deleteIssueRequest(issue.id);
              } catch (cause) {
                patchIssue(issue);
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Failed to delete the task.",
                );
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ]);
    },
    [patchIssue, removeIssue],
  );

  const issues = payload?.issues ?? [];
  const open = useMemo(
    () => issues.filter((issue) => issue.status === "open"),
    [issues],
  );
  const dueSoon = useMemo(
    () =>
      open.filter(
        (issue) =>
          issue.state === "active" &&
          (issue.dueSoon ||
            (issue.dueDate !== null &&
              issue.dueDate <= new Date().toISOString().slice(0, 10))),
      ),
    [open],
  );
  const later = useMemo(
    () =>
      open.filter(
        (issue) =>
          issue.state === "active" &&
          !dueSoon.some((row) => row.id === issue.id),
      ),
    [open, dueSoon],
  );
  const parked = useMemo(
    () => open.filter((issue) => issue.state === "dormant"),
    [open],
  );
  const resolved = useMemo(
    () => issues.filter((issue) => issue.status === "resolved"),
    [issues],
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor }}
      edges={["left", "right"]}
    >
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-28 pt-2">
        <Text className="mb-1 text-[28px] font-semibold tracking-tight text-foreground">
          Tasks
        </Text>
        <Text className="mb-6 text-[15px] leading-5 text-muted-foreground">
          Capture and clear open loops.
        </Text>

        {error ? (
          <Pressable
            accessibilityRole="button"
            className="mb-4 rounded-2xl bg-destructive/10 px-4 py-3"
            onPress={() => void reload()}
          >
            <Text className="text-[14px] text-destructive">{error}</Text>
            <Text className="mt-1 text-[12px] text-destructive/80">
              Tap to retry
            </Text>
          </Pressable>
        ) : null}

        {!payload && !error ? (
          <ActivityIndicator color={placeholderColor ?? undefined} />
        ) : (
          <>
            <TaskGroup
              title="Due soon"
              issues={dueSoon}
              busyId={busyId}
              onResolve={setResolved}
              onEdit={setEditing}
              onDelete={deleteTask}
              empty="Nothing due soon"
            />
            <TaskGroup
              title="Later"
              issues={later}
              busyId={busyId}
              onResolve={setResolved}
              onEdit={setEditing}
              onDelete={deleteTask}
              empty="Nothing waiting"
            />
            {parked.length > 0 ? (
              <TaskGroup
                title="Parked"
                issues={parked}
                busyId={busyId}
                onResolve={setResolved}
                onEdit={setEditing}
                onDelete={deleteTask}
              />
            ) : null}
            {resolved.length > 0 ? (
              <TaskGroup
                title="Resolved"
                issues={resolved}
                busyId={busyId}
                onResolve={setResolved}
                onEdit={setEditing}
                onDelete={deleteTask}
              />
            ) : null}
          </>
        )}
      </ScrollView>

      <View
        pointerEvents="box-none"
        className="absolute right-5 bottom-0 left-5"
        style={{ paddingBottom: 24 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New task"
          className="min-h-14 flex-row items-center justify-center gap-2 rounded-full bg-foreground active:opacity-85"
          onPress={() => setComposerOpen(true)}
        >
          <Icon as={PlusIcon} className="size-5 text-background" />
          <Text className="text-[17px] font-medium text-background">
            New task
          </Text>
        </Pressable>
      </View>

      <TaskComposer
        open={composerOpen || editing !== null}
        initial={editing}
        onClose={() => {
          setComposerOpen(false);
          setEditing(null);
        }}
        onCreated={(created) => {
          animateList();
          setPayload((current) =>
            current
              ? { ...current, issues: [created, ...current.issues] }
              : current,
          );
          setComposerOpen(false);
        }}
        onUpdated={(updated) => {
          patchIssue(updated);
          setEditing(null);
        }}
      />
    </SafeAreaView>
  );
}

function TaskGroup({
  title,
  issues,
  busyId,
  onResolve,
  onEdit,
  onDelete,
  empty,
}: {
  readonly title: string;
  readonly issues: readonly IssueDto[];
  readonly busyId: string | null;
  readonly onResolve: (issue: IssueDto, resolved: boolean) => Promise<void>;
  readonly onEdit: (issue: IssueDto) => void;
  readonly onDelete: (issue: IssueDto) => void;
  readonly empty?: string;
}) {
  return (
    <View className="mb-7">
      <Text className="mb-2.5 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
        {issues.length > 0 ? ` · ${issues.length}` : ""}
      </Text>
      {issues.length === 0 ? (
        empty ? (
          <Text className="px-1 text-[15px] text-muted-foreground">{empty}</Text>
        ) : null
      ) : (
        <View className="overflow-hidden rounded-2xl bg-muted/35">
          {issues.map((issue, index) => (
            <Animated.View
              key={issue.id}
              entering={FadeInDown.duration(220)}
              exiting={FadeOutUp.duration(180)}
              layout={LinearTransition.springify().damping(22)}
              className={index === 0 ? "" : "border-t border-border/40"}
            >
              <TaskRow
                issue={issue}
                busy={busyId === issue.id}
                onResolve={onResolve}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
}

function TaskRow({
  issue,
  busy,
  onResolve,
  onEdit,
  onDelete,
}: {
  readonly issue: IssueDto;
  readonly busy: boolean;
  readonly onResolve: (issue: IssueDto, resolved: boolean) => Promise<void>;
  readonly onEdit: (issue: IssueDto) => void;
  readonly onDelete: (issue: IssueDto) => void;
}) {
  const resolved = issue.status === "resolved";
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const meta = [
    issue.dueDate
      ? `${issue.dueDate < new Date().toISOString().slice(0, 10) ? "Overdue" : "Due"} ${issue.dueDate}`
      : null,
    issue.reviewDate ? `Review ${issue.reviewDate}` : null,
    issue.state === "dormant" ? "Parked" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="flex-row items-start gap-3 px-3.5 py-3.5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={resolved ? "Reopen task" : "Complete task"}
        disabled={busy}
        className={`mt-0.5 h-7 w-7 items-center justify-center rounded-full border ${resolved ? "border-border bg-muted" : "border-foreground/30"}`}
        onPress={() => void onResolve(issue, !resolved)}
      >
        {busy ? (
          <ActivityIndicator size="small" color={placeholderColor ?? undefined} />
        ) : resolved ? (
          <Icon as={CheckIcon} className="size-4 text-foreground" />
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${issue.title}`}
        className="min-w-0 flex-1"
        onPress={() => onEdit(issue)}
        onLongPress={() => onDelete(issue)}
      >
        <Text
          className={`text-[16px] leading-5 ${resolved ? "text-muted-foreground line-through" : "text-foreground"}`}
        >
          {issue.title}
        </Text>
        {issue.description ? (
          <Text
            className="mt-1 text-[13px] leading-4 text-muted-foreground"
            numberOfLines={2}
          >
            {issue.description}
          </Text>
        ) : null}
        {meta ? (
          <Text className="mt-1.5 text-[12px] text-muted-foreground">{meta}</Text>
        ) : null}
      </Pressable>
      <View className="flex-row items-center gap-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit task"
          className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
          onPress={() => onEdit(issue)}
        >
          <Icon as={PencilIcon} className="size-4 text-muted-foreground" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete task"
          className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
          onPress={() => onDelete(issue)}
        >
          <Icon as={Trash2Icon} className="size-4 text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  );
}

function formatDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function DateField({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const selected = value ? new Date(`${value}T12:00:00`) : new Date();
  const picker = open ? (
    <DateTimePicker
      value={selected}
      mode="date"
      display={Platform.OS === "ios" ? "inline" : "default"}
      presentation={Platform.OS === "ios" ? "inline" : "dialog"}
      onValueChange={(_event, date) => {
        onChange(formatDay(date));
        if (Platform.OS !== "ios") setOpen(false);
      }}
      onDismiss={() => setOpen(false)}
    />
  ) : null;

  return (
    <View className="flex-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} date, ${value || "none"}`}
        className="min-h-12 justify-center rounded-2xl bg-muted/50 px-3"
        onPress={() => setOpen(true)}
      >
        <Text className="text-[12px] text-muted-foreground">{label}</Text>
        <Text className="mt-0.5 text-[15px] text-foreground">
          {value || "None"}
        </Text>
      </Pressable>
      {Platform.OS === "ios" ? (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <View className="flex-1 justify-end bg-foreground/40">
            <View
              style={{ backgroundColor }}
              className="rounded-t-3xl px-4 pb-8 pt-4"
            >
              <Text className="mb-2 text-lg font-semibold text-foreground">
                {label}
              </Text>
              {picker}
              <View className="mt-2 flex-row justify-between">
                <Pressable
                  accessibilityRole="button"
                  className="min-h-11 justify-center px-4"
                  onPress={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <Text className="text-foreground">Clear</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  className="min-h-11 justify-center px-4"
                  onPress={() => setOpen(false)}
                >
                  <Text className="font-medium text-foreground">Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : (
        picker
      )}
    </View>
  );
}

function TaskComposer({
  open,
  initial,
  onClose,
  onCreated,
  onUpdated,
}: {
  readonly open: boolean;
  readonly initial: IssueDto | null;
  readonly onClose: () => void;
  readonly onCreated: (created: IssueDto) => void;
  readonly onUpdated: (updated: IssueDto) => void;
}) {
  const isEdit = initial !== null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const primaryForeground = useCSSVariable("--color-primary-foreground") as
    | string
    | undefined;

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setDueDate(initial?.dueDate ?? "");
    setReviewDate(initial?.reviewDate ?? "");
    setError(null);
    setPending(false);
  }, [open, initial]);

  const submit = () => {
    if (!title.trim()) {
      setError("A title is required.");
      return;
    }
    setPending(true);
    if (isEdit && initial) {
      void updateIssueRequest(initial.id, {
        title: title.trim(),
        description: description.trim() || null,
        dueDate: dueDate.trim() || null,
        reviewDate: reviewDate.trim() || null,
      })
        .then(onUpdated)
        .catch((cause: unknown) =>
          setError(
            cause instanceof Error ? cause.message : "Failed to update the task.",
          ),
        )
        .finally(() => setPending(false));
      return;
    }
    void createIssueRequest({
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate.trim() || null,
      reviewDate: reviewDate.trim() || null,
    })
      .then(onCreated)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Failed to create the task.",
        ),
      )
      .finally(() => setPending(false));
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          className="absolute inset-0 bg-foreground/40"
          onPress={onClose}
        />
        <View
          style={{ backgroundColor }}
          className="rounded-t-3xl border-t border-border/50 px-5 pb-10 pt-3"
        >
          <View className="mb-3 items-center">
            <View className="h-1 w-9 rounded-full bg-border" />
          </View>
          <Text className="mb-4 text-[22px] font-semibold text-foreground">
            {isEdit ? "Edit task" : "New task"}
          </Text>
          <TextInput
            className="mb-3 min-h-12 rounded-2xl bg-muted/50 px-4 text-[17px] text-foreground"
            placeholder="What needs doing?"
            placeholderTextColor={placeholderColor ?? undefined}
            value={title}
            onChangeText={setTitle}
            autoFocus
          />
          <TextInput
            className="mb-3 min-h-[88px] rounded-2xl bg-muted/50 px-4 py-3 text-[15px] text-foreground"
            placeholder="Notes"
            placeholderTextColor={placeholderColor ?? undefined}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
          <View className="mb-4 flex-row gap-3">
            <DateField label="Due" value={dueDate} onChange={setDueDate} />
            <DateField
              label="Review"
              value={reviewDate}
              onChange={setReviewDate}
            />
          </View>
          {error ? (
            <Text className="mb-3 text-[14px] text-destructive">{error}</Text>
          ) : null}
          <View className="flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              className="min-h-12 flex-1 items-center justify-center rounded-2xl bg-muted/60"
              onPress={onClose}
            >
              <Text className="text-[16px] text-foreground">Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="min-h-12 flex-1 items-center justify-center rounded-2xl bg-foreground"
              disabled={pending}
              onPress={submit}
            >
              {pending ? (
                <ActivityIndicator size="small" color={primaryForeground} />
              ) : (
                <Text className="text-[16px] font-medium text-background">
                  {isEdit ? "Save" : "Add"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
