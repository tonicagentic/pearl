import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  ChevronRightIcon,
  FolderIcon,
  InboxIcon,
  PlusIcon,
  TargetIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react-native";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { TaskRow } from "@/components/tasks/task-row";
import { useTasksActions } from "@/components/tasks/use-tasks-actions";
import { fetchMonthSpendSummary } from "@/src/finances-client";
import { fetchAllGoals, type GoalDto } from "@/src/goals-client";
import { fetchIssues } from "@/src/issues-client";
import { useNetworkStatus } from "@/src/network-status";
import { fetchProjects, type ProjectDto } from "@/src/projects-client";
import {
  queryErrorMessage,
  queryKeys,
  showQueryErrorBanner,
} from "@/src/query-client";
import {
  getTrackShowFinance,
  loadTrackShowFinance,
  setTrackShowFinance,
  subscribeTrackShowFinance,
} from "@/src/track-finance-pref";
import {
  issuesForSmartBucket,
  smartListCounts,
} from "@/src/task-smart-lists";

const PREVIEW = 4;

function currentYearMonth(d = new Date()) {
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * Home Track tab: quick-jump cards for tasks, goals, projects, and optional
 * finance. Headers navigate to the full drawer hubs.
 */
export function TrackScreen() {
  const { offline } = useNetworkStatus();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const showFinance = useSyncExternalStore(
    subscribeTrackShowFinance,
    getTrackShowFinance,
    getTrackShowFinance,
  );

  useEffect(() => {
    void loadTrackShowFinance();
  }, []);

  const { busyId, setResolved, deleteTask } = useTasksActions();

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks,
    queryFn: fetchIssues,
  });
  const goalsQuery = useQuery({
    queryKey: queryKeys.goals,
    queryFn: fetchAllGoals,
  });
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: fetchProjects,
  });

  const now = currentYearMonth();
  const financeQuery = useQuery({
    queryKey: queryKeys.financesMonth(now.year, now.month),
    queryFn: () =>
      fetchMonthSpendSummary({ year: now.year, month: now.month }),
    enabled: showFinance,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const refetchTasks = tasksQuery.refetch;
  const refetchGoals = goalsQuery.refetch;
  const refetchProjects = projectsQuery.refetch;
  const refetchFinance = financeQuery.refetch;

  useFocusEffect(
    useCallback(() => {
      void refetchTasks();
      void refetchGoals();
      void refetchProjects();
      if (showFinance) void refetchFinance();
    }, [
      refetchFinance,
      refetchGoals,
      refetchProjects,
      refetchTasks,
      showFinance,
    ]),
  );

  const issues = useMemo(
    () => tasksQuery.data?.issues ?? [],
    [tasksQuery.data?.issues],
  );
  const counts = useMemo(() => smartListCounts(issues), [issues]);
  const todayPreview = useMemo(
    () => issuesForSmartBucket(issues, "today").slice(0, PREVIEW),
    [issues],
  );

  const activeGoals = useMemo(() => {
    const rows = (goalsQuery.data ?? []).filter((g) => g.status === "active");
    return [...rows].sort((a, b) => {
      if (a.targetDate && b.targetDate) {
        return a.targetDate.localeCompare(b.targetDate);
      }
      if (a.targetDate) return -1;
      if (b.targetDate) return 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [goalsQuery.data]);
  const goalPreview = activeGoals.slice(0, PREVIEW);

  const projects = useMemo(() => {
    const rows = [...(projectsQuery.data ?? [])].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    return rows.slice(0, PREVIEW);
  }, [projectsQuery.data]);

  const openTaskCountByProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const issue of issues) {
      if (issue.status !== "open" || !issue.projectId) continue;
      map.set(issue.projectId, (map.get(issue.projectId) ?? 0) + 1);
    }
    return map;
  }, [issues]);

  const loading =
    (tasksQuery.isPending && !tasksQuery.data) ||
    (goalsQuery.isPending && !goalsQuery.data) ||
    (projectsQuery.isPending && !projectsQuery.data);

  const bannerError =
    showQueryErrorBanner(offline, tasksQuery.error) ||
    showQueryErrorBanner(offline, goalsQuery.error) ||
    showQueryErrorBanner(offline, projectsQuery.error)
      ? tasksQuery.error ?? goalsQuery.error ?? projectsQuery.error
      : null;

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {bannerError ? (
          <Pressable
            accessibilityRole="button"
            className="mb-4 rounded-2xl bg-destructive/10 px-4 py-3"
            onPress={() => {
              void tasksQuery.refetch();
              void goalsQuery.refetch();
              void projectsQuery.refetch();
            }}
          >
            <Text variant="secondary" tone="destructive">
              {queryErrorMessage(bannerError, "Failed to load Track.")}
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

        {loading ? (
          <ActivityIndicator color={placeholderColor ?? undefined} />
        ) : (
          <>
            <TrackCard
              icon={InboxIcon}
              title="Tasks"
              detail={`${counts.today} today · ${counts.inbox} inbox`}
              onPress={() => router.navigate("/tasks")}
            >
              {todayPreview.length === 0 ? (
                <EmptyLine text="Nothing due today" />
              ) : (
                todayPreview.map((issue, index) => (
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
            </TrackCard>

            <TrackCard
              icon={TargetIcon}
              title="Goals"
              detail={
                activeGoals.length === 0
                  ? "No active goals"
                  : `${activeGoals.length} active`
              }
              onPress={() => router.navigate("/goals")}
            >
              {goalPreview.length === 0 ? (
                <EmptyLine text="No active goals" />
              ) : (
                goalPreview.map((goal, index) => (
                  <GoalPreviewRow
                    key={goal.id}
                    goal={goal}
                    first={index === 0}
                  />
                ))
              )}
            </TrackCard>

            <TrackCard
              icon={FolderIcon}
              title="Projects"
              detail={
                (projectsQuery.data?.length ?? 0) === 0
                  ? "No projects"
                  : `${projectsQuery.data?.length ?? 0} projects`
              }
              onPress={() => router.navigate("/workspaces")}
            >
              {projects.length === 0 ? (
                <EmptyLine text="No projects yet" />
              ) : (
                projects.map((project, index) => (
                  <ProjectPreviewRow
                    key={project.id}
                    project={project}
                    openTasks={openTaskCountByProject.get(project.id) ?? 0}
                    first={index === 0}
                  />
                ))
              )}
            </TrackCard>

            {showFinance ? (
              <TrackCard
                icon={WalletIcon}
                title="Finance"
                detail={
                  financeQuery.isPending && !financeQuery.data
                    ? "This month"
                    : financeQuery.data
                      ? financeQuery.data.totalSpentLabel
                      : "This month"
                }
                onPress={() => router.navigate("/finances")}
              >
                {financeQuery.error ? (
                  <EmptyLine
                    text={queryErrorMessage(
                      financeQuery.error,
                      "Finances isn’t available for this account.",
                    )}
                  />
                ) : financeQuery.data ? (
                  <FinancePreview summary={financeQuery.data} />
                ) : financeQuery.isPending ? (
                  <View className="px-3.5 py-3.5">
                    <ActivityIndicator
                      color={placeholderColor ?? undefined}
                    />
                  </View>
                ) : (
                  <EmptyLine text="No spend this month" />
                )}
              </TrackCard>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add Finance to Track"
                className="mb-5 flex-row items-center gap-3 rounded-2xl bg-muted/35 px-3.5 py-3.5 active:bg-muted/50"
                onPress={() => void setTrackShowFinance(true)}
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
                  <Icon as={PlusIcon} className="size-4 text-foreground" />
                </View>
                <View className="min-w-0 flex-1">
                  <Text variant="label" weight="semibold">
                    Add Finance
                  </Text>
                  <Text variant="caption" className="mt-0.5">
                    Show this month’s spend on Track
                  </Text>
                </View>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TrackCard({
  icon: CardIcon,
  title,
  detail,
  onPress,
  children,
}: {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly detail: string;
  readonly onPress: () => void;
  readonly children: ReactNode;
}) {
  return (
    <View className="mb-5 overflow-hidden rounded-2xl bg-muted/35">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${detail}`}
        className="flex-row items-center gap-3 px-3.5 py-3.5 active:bg-muted/50"
        onPress={onPress}
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
          <Icon as={CardIcon} className="size-4 text-foreground" />
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="label" weight="semibold">
            {title}
          </Text>
          <Text variant="caption" className="mt-0.5">
            {detail}
          </Text>
        </View>
        <Icon as={ChevronRightIcon} className="size-4 text-muted-foreground" />
      </Pressable>
      <View className="border-t border-border/40">{children}</View>
    </View>
  );
}

function EmptyLine({ text }: { readonly text: string }) {
  return (
    <Text variant="body" tone="muted" className="px-3.5 py-3.5">
      {text}
    </Text>
  );
}

function GoalPreviewRow({
  goal,
  first,
}: {
  readonly goal: GoalDto;
  readonly first: boolean;
}) {
  const meta = [
    goal.projectName ?? "No project",
    goal.targetDate ? `Target ${goal.targetDate}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={goal.title}
      className={`px-3.5 py-3.5 active:bg-muted/50 ${first ? "" : "border-t border-border/40"}`}
      onPress={() => router.navigate("/goals")}
    >
      <Text variant="body">{goal.title}</Text>
      <Text variant="caption" className="mt-1">
        {meta}
      </Text>
    </Pressable>
  );
}

function ProjectPreviewRow({
  project,
  openTasks,
  first,
}: {
  readonly project: ProjectDto;
  readonly openTasks: number;
  readonly first: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={project.name}
      className={`px-3.5 py-3.5 active:bg-muted/50 ${first ? "" : "border-t border-border/40"}`}
      onPress={() =>
        router.push(
          `/workspaces/projects/${encodeURIComponent(project.id)}`,
        )
      }
    >
      <Text variant="body" weight="medium">
        {project.name}
      </Text>
      <Text variant="caption" className="mt-1">
        {openTasks === 0
          ? "No open tasks"
          : openTasks === 1
            ? "1 open task"
            : `${String(openTasks)} open tasks`}
      </Text>
    </Pressable>
  );
}

function FinancePreview({
  summary,
}: {
  readonly summary: {
    readonly totalSpentLabel: string;
    readonly groups: readonly { readonly name: string; readonly amount: number }[];
  };
}) {
  const top = [...summary.groups].sort((a, b) => b.amount - a.amount)[0];
  return (
    <View className="px-3.5 py-3.5">
      <Text variant="body">{summary.totalSpentLabel} this month</Text>
      {top ? (
        <Text variant="caption" className="mt-1">
          Top: {top.name}
        </Text>
      ) : (
        <Text variant="caption" className="mt-1">
          No groups yet
        </Text>
      )}
    </View>
  );
}
