import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useCSSVariable } from "uniwind";

import { ScreenChrome } from "@/components/navigation/screen-chrome";
import {
  TaskMagicPlusFab,
  TASK_MAGIC_PLUS_CLEARANCE,
} from "@/components/tasks/task-magic-plus-fab";
import { TaskQuickAddCard } from "@/components/tasks/task-quick-add-card";
import { TaskRow } from "@/components/tasks/task-row";
import { useTasksActions } from "@/components/tasks/use-tasks-actions";
import { Text } from "@/components/ui/text";
import {
  fetchIssues,
  issuesInAreaSubtree,
} from "@/src/issues-client";
import { useNetworkStatus } from "@/src/network-status";
import {
  queryErrorMessage,
  queryKeys,
  showQueryErrorBanner,
} from "@/src/query-client";
import {
  isTaskSmartBucket,
  issuesForSmartBucket,
  TASK_SMART_LIST_META,
  type TaskSmartBucket,
} from "@/src/task-smart-lists";

/** One Things-style smart list (Inbox, Today, …). */
export function TaskListScreen({
  bucketParam,
  areaRootName,
  defaultAreaName,
}: {
  readonly bucketParam: string;
  readonly areaRootName?: string;
  readonly defaultAreaName?: string;
}) {
  const bucket: TaskSmartBucket = isTaskSmartBucket(bucketParam)
    ? bucketParam
    : "inbox";
  const meta =
    TASK_SMART_LIST_META.find((row) => row.id === bucket) ??
    TASK_SMART_LIST_META[0]!;
  const allowCreate = bucket !== "logbook";

  const { offline } = useNetworkStatus();
  const [composerOpen, setComposerOpen] = useState(false);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const {
    busyId,
    actionError,
    setActionError,
    prependIssue,
    setResolved,
    deleteTask,
  } = useTasksActions();

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks,
    queryFn: fetchIssues,
  });

  useFocusEffect(
    useCallback(() => {
      void tasksQuery.refetch();
    }, [tasksQuery.refetch]),
  );

  const scopedIssues = useMemo(() => {
    const all = tasksQuery.data?.issues ?? [];
    if (!areaRootName) return all;
    return issuesInAreaSubtree(all, tasksQuery.data?.tree, areaRootName);
  }, [areaRootName, tasksQuery.data?.issues, tasksQuery.data?.tree]);

  const issues = useMemo(
    () => issuesForSmartBucket(scopedIssues, bucket),
    [scopedIssues, bucket],
  );

  const showLoadError = showQueryErrorBanner(offline, tasksQuery.error);
  const showActionError = showQueryErrorBanner(offline, actionError);
  const bannerError = showActionError
    ? actionError
    : showLoadError
      ? tasksQuery.error
      : null;

  return (
    <ScreenChrome title={meta.label} leading="back">
      <View style={{ flex: 1, backgroundColor }}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-1"
          contentContainerStyle={{
            paddingBottom: allowCreate ? TASK_MAGIC_PLUS_CLEARANCE : 24,
            flexGrow: 1,
          }}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="title" className="mb-1">
            {meta.label}
          </Text>
          <Text variant="secondary" tone="muted" className="mb-5">
            {issues.length === 0
              ? "No tasks"
              : `${issues.length} task${issues.length === 1 ? "" : "s"}`}
          </Text>

          {bannerError ? (
            <Pressable
              accessibilityRole="button"
              className="mb-4 rounded-2xl bg-destructive/10 px-4 py-3"
              onPress={() => {
                setActionError(null);
                void tasksQuery.refetch();
              }}
            >
              <Text variant="secondary" tone="destructive">
                {typeof bannerError === "string"
                  ? bannerError
                  : queryErrorMessage(bannerError, "Failed to load tasks.")}
              </Text>
            </Pressable>
          ) : null}

          {!tasksQuery.data && tasksQuery.isPending ? (
            <ActivityIndicator color={placeholderColor ?? undefined} />
          ) : issues.length === 0 ? (
            <View className="flex-1 items-center justify-center py-24 opacity-30">
              <Text variant="title" tone="muted">
                {meta.label}
              </Text>
            </View>
          ) : (
            <View className="overflow-hidden rounded-2xl bg-muted/35">
              {issues.map((issue, index) => (
                <TaskRow
                  key={issue.id}
                  issue={issue}
                  index={index}
                  busy={busyId === issue.id}
                  onResolve={setResolved}
                  onDelete={deleteTask}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {allowCreate ? (
          <>
            <TaskMagicPlusFab
              hidden={composerOpen}
              onPress={() => setComposerOpen(true)}
              accessibilityLabel={`New ${meta.label} task`}
            />
            <TaskQuickAddCard
              open={composerOpen}
              bucket={bucket}
              areaName={defaultAreaName}
              onClose={() => setComposerOpen(false)}
              onCreated={prependIssue}
            />
          </>
        ) : null}
      </View>
    </ScreenChrome>
  );
}
