import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  ArchiveIcon,
  BoxIcon,
  CalendarDaysIcon,
  InboxIcon,
  LayersIcon,
  StarIcon,
  type LucideIcon,
} from "lucide-react-native";
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
import { Icon } from "@/components/ui/icon";
import { Text, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
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
  issuesForSmartBucket,
  searchIssues,
  smartListCounts,
  TASK_SMART_LIST_META,
  type TaskSmartBucket,
} from "@/src/task-smart-lists";

const BUCKET_ICONS: Record<TaskSmartBucket, LucideIcon> = {
  inbox: InboxIcon,
  today: StarIcon,
  upcoming: CalendarDaysIcon,
  anytime: LayersIcon,
  someday: BoxIcon,
  logbook: ArchiveIcon,
};

const TODAY_PREVIEW = 5;

/** Tasks home: Quick Find, smart lists, Today preview, Magic Plus. */
export function TasksScreen({
  leading = "drawer",
  title = "Tasks",
  header,
  areaRootName,
  defaultAreaName,
}: {
  readonly leading?: "drawer" | "back";
  readonly title?: string;
  readonly header?: ReactNode;
  /** When set, only show tasks in this life-area subtree (e.g. Finances). */
  readonly areaRootName?: string;
  /** Area name for newly created tasks (defaults to Inbox via quick-add). */
  readonly defaultAreaName?: string;
} = {}) {
  const { offline } = useNetworkStatus();
  const [composerOpen, setComposerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const mutedBg = useCSSVariable("--color-muted") as string | undefined;

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

  const payload = tasksQuery.data ?? null;
  const allIssues = payload?.issues ?? [];
  const issues = useMemo(
    () =>
      areaRootName
        ? issuesInAreaSubtree(allIssues, payload?.tree, areaRootName)
        : allIssues,
    [allIssues, areaRootName, payload?.tree],
  );
  const counts = useMemo(() => smartListCounts(issues), [issues]);
  const todayPreview = useMemo(
    () => issuesForSmartBucket(issues, "today").slice(0, TODAY_PREVIEW),
    [issues],
  );
  const hits = useMemo(() => searchIssues(issues, query), [issues, query]);
  const searching = query.trim().length > 0;

  const showLoadError = showQueryErrorBanner(offline, tasksQuery.error);
  const showActionError = showQueryErrorBanner(offline, actionError);
  const bannerError = showActionError
    ? actionError
    : showLoadError
      ? tasksQuery.error
      : null;

  const openSmartList = useCallback(
    (bucket: TaskSmartBucket) => {
      const path = `/tasks/list/${encodeURIComponent(bucket)}`;
      if (areaRootName) {
        router.push(
          `${path}?areaRoot=${encodeURIComponent(areaRootName)}${
            defaultAreaName
              ? `&areaName=${encodeURIComponent(defaultAreaName)}`
              : ""
          }` as never,
        );
        return;
      }
      router.push(path as never);
    },
    [areaRootName, defaultAreaName],
  );

  return (
    <ScreenChrome title={title} leading={leading}>
      <View style={{ flex: 1, backgroundColor }}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-1"
          contentContainerStyle={{ paddingBottom: TASK_MAGIC_PLUS_CLEARANCE }}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          {header}

          <View
            className="mb-4 flex-row items-center rounded-2xl px-3.5 py-2.5"
            style={{ backgroundColor: mutedBg ?? undefined, opacity: 0.9 }}
          >
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Quick Find"
              placeholderTextColor={placeholderColor ?? undefined}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              className={cn(
                textVariants({ variant: "body" }),
                "min-h-9 flex-1 py-0 text-foreground",
              )}
            />
          </View>

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
              <Text
                variant="caption"
                tone="destructive"
                className="mt-1 opacity-80"
              >
                Tap to retry
              </Text>
            </Pressable>
          ) : null}

          {!payload && tasksQuery.isPending ? (
            <ActivityIndicator color={placeholderColor ?? undefined} />
          ) : searching ? (
            <View className="overflow-hidden rounded-2xl bg-muted/35">
              {hits.length === 0 ? (
                <Text variant="body" tone="muted" className="px-3.5 py-4">
                  No matches
                </Text>
              ) : (
                hits.map((issue, index) => (
                  <TaskRow
                    key={issue.id}
                    issue={issue}
                    index={index}
                    busy={busyId === issue.id}
                    onResolve={setResolved}
                    onDelete={deleteTask}
                  />
                ))
              )}
            </View>
          ) : (
            <>
              <View className="mb-5 overflow-hidden rounded-2xl bg-muted/35">
                {TASK_SMART_LIST_META.map((meta, index) => {
                  const count = counts[meta.id];
                  return (
                    <Pressable
                      key={meta.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${meta.label}, ${count}`}
                      className={`flex-row items-center gap-3 px-3.5 py-3.5 active:bg-muted/50 ${
                        index === 0 ? "" : "border-t border-border/40"
                      }`}
                      onPress={() => openSmartList(meta.id)}
                    >
                      <View className="h-8 w-8 items-center justify-center rounded-lg bg-muted/70">
                        <Icon
                          as={BUCKET_ICONS[meta.id]}
                          className="size-4 text-foreground"
                        />
                      </View>
                      <Text variant="body" className="min-w-0 flex-1">
                        {meta.label}
                      </Text>
                      {count > 0 ? (
                        <Text variant="secondary" tone="muted">
                          {count}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {todayPreview.length > 0 ? (
                <View className="mb-4">
                  <View className="mb-2.5 h-px bg-border/50" />
                  <Text
                    variant="secondary"
                    weight="medium"
                    className="mb-2.5 uppercase tracking-wide"
                  >
                    Today
                  </Text>
                  <View className="overflow-hidden rounded-2xl bg-muted/35">
                    {todayPreview.map((issue, index) => (
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
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        <TaskMagicPlusFab
          hidden={composerOpen}
          onPress={() => setComposerOpen(true)}
        />
        <TaskQuickAddCard
          open={composerOpen}
          bucket="inbox"
          areaName={defaultAreaName}
          onClose={() => setComposerOpen(false)}
          onCreated={prependIssue}
        />
      </View>
    </ScreenChrome>
  );
}
