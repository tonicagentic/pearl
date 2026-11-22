import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Pressable,
  ScrollView,
  UIManager,
  View,
  Platform,
} from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import { CheckIcon, PlusIcon, Trash2Icon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { CreateTaskModal } from "@/components/home/create-task-modal";
import { StackScreen } from "@/components/ui/stack-screen";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
  deleteIssueRequest,
  fetchIssues,
  setIssueResolvedRequest,
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

/** Tasks inbox: due soon, later, parked, and recently resolved. */
export function TasksScreen() {
  const [payload, setPayload] = useState<IssuesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const openComposer = useCallback(() => setComposerOpen(true), []);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setPayload(await fetchIssues());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load tasks.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
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
    }, []),
  );

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
    <StackScreen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Tasks",
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: foregroundColor,
          headerRight:
            Platform.OS === "ios"
              ? undefined
              : () => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="New task"
                    className="h-10 w-10 items-center justify-center"
                    onPress={openComposer}
                  >
                    <Icon as={PlusIcon} className="size-5 text-foreground" />
                  </Pressable>
                ),
        }}
      />
      {Platform.OS === "ios" ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="plus"
            accessibilityLabel="New task"
            onPress={openComposer}
          />
        </Stack.Toolbar>
      ) : null}
      <View style={{ flex: 1, backgroundColor }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-0"
        contentContainerStyle={{ paddingBottom: 24 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {error ? (
          <Pressable
            accessibilityRole="button"
            className="mb-4 rounded-2xl bg-destructive/10 px-4 py-3"
            onPress={() => void reload()}
          >
            <Text variant="secondary" tone="destructive">
              {error}
            </Text>
            <Text
              variant="caption"
              tone="destructive"
              className="mt-1 opacity-80"
            >
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
              onDelete={deleteTask}
              empty="Nothing due soon"
            />
            <TaskGroup
              title="Later"
              issues={later}
              busyId={busyId}
              onResolve={setResolved}
              onDelete={deleteTask}
              empty="Nothing waiting"
            />
            {parked.length > 0 ? (
              <TaskGroup
                title="Parked"
                issues={parked}
                busyId={busyId}
                onResolve={setResolved}
                onDelete={deleteTask}
              />
            ) : null}
            {resolved.length > 0 ? (
              <TaskGroup
                title="Resolved"
                issues={resolved}
                busyId={busyId}
                onResolve={setResolved}
                onDelete={deleteTask}
              />
            ) : null}
          </>
        )}
      </ScrollView>

      <CreateTaskModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={(created) => {
          animateList();
          setPayload((current) =>
            current
              ? { ...current, issues: [created, ...current.issues] }
              : current,
          );
          setComposerOpen(false);
          router.push(`/issues/${encodeURIComponent(created.id)}`);
        }}
      />
      </View>
    </StackScreen>
  );
}

function TaskGroup({
  title,
  issues,
  busyId,
  onResolve,
  onDelete,
  empty,
}: {
  readonly title: string;
  readonly issues: readonly IssueDto[];
  readonly busyId: string | null;
  readonly onResolve: (issue: IssueDto, resolved: boolean) => Promise<void>;
  readonly onDelete: (issue: IssueDto) => void;
  readonly empty?: string;
}) {
  return (
    <View className="mb-7">
      <Text
        variant="secondary"
        weight="medium"
        className="mb-2.5 uppercase tracking-wide"
      >
        {title}
        {issues.length > 0 ? ` · ${issues.length}` : ""}
      </Text>
      {issues.length === 0 ? (
        empty ? (
          <Text variant="body" tone="muted" className="px-1">
            {empty}
          </Text>
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
  onDelete,
}: {
  readonly issue: IssueDto;
  readonly busy: boolean;
  readonly onResolve: (issue: IssueDto, resolved: boolean) => Promise<void>;
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
          <ActivityIndicator
            size="small"
            color={placeholderColor ?? undefined}
          />
        ) : resolved ? (
          <Icon as={CheckIcon} className="size-4 text-foreground" />
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${issue.title}`}
        className="min-w-0 flex-1"
        onPress={() => router.push(`/issues/${encodeURIComponent(issue.id)}`)}
        onLongPress={() => onDelete(issue)}
      >
        <Text
          variant="body"
          tone={resolved ? "muted" : "default"}
          className={resolved ? "line-through" : undefined}
        >
          {issue.title}
        </Text>
        {issue.description ? (
          <Text variant="secondary" className="mt-1" numberOfLines={2}>
            {issue.description}
          </Text>
        ) : null}
        {meta ? (
          <Text variant="caption" className="mt-1.5">
            {meta}
          </Text>
        ) : null}
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
  );
}
