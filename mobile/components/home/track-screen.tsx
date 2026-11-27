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
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCSSVariable } from "uniwind";

import { Text } from "@/components/ui/text";
import { TaskRow } from "@/components/tasks/task-row";
import { useTasksActions } from "@/components/tasks/use-tasks-actions";
import { useAuth } from "@/src/auth";
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
  firstNameFrom,
  overviewDateLabel,
  overviewGoalsLead,
  overviewGreeting,
  overviewProjectHref,
  overviewProjectsLead,
  overviewTasksLead,
} from "@/src/overview-ui";
import {
  getTrackShowFinance,
  loadTrackShowFinance,
  subscribeTrackShowFinance,
} from "@/src/track-finance-pref";
import {
  issuesForSmartBucket,
  smartListCounts,
} from "@/src/task-smart-lists";

function currentYearMonth(d = new Date()) {
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * Home Overview tab: greeting + narrative summary of tasks, goals, projects,
 * and optional finance. Lead sentences jump to the full drawer hubs.
 */
export function TrackScreen() {
  const { offline } = useNetworkStatus();
  const { viewerName } = useAuth();
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
  const todayTasks = useMemo(
    () => issuesForSmartBucket(issues, "today"),
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

  const projects = useMemo(() => {
    return [...(projectsQuery.data ?? [])].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
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

  const clock = useMemo(() => new Date(), []);
  const greeting = overviewGreeting(clock, firstNameFrom(viewerName));
  const dateLabel = overviewDateLabel(clock);

  const tasksLead = useMemo(
    () =>
      overviewTasksLead({
        dueToday: todayTasks.length,
        inbox: counts.inbox,
      }),
    [counts.inbox, todayTasks.length],
  );

  const goalsLead = overviewGoalsLead(activeGoals.length);
  const projectsLead = overviewProjectsLead(projects.length);

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
              {queryErrorMessage(bannerError, "Failed to load Overview.")}
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
            <View className="mb-6">
              <Text variant="title">{greeting}</Text>
              <Text variant="secondary" className="mt-1">
                {dateLabel}
              </Text>
            </View>

            <OverviewBeat lead={tasksLead}>
              {todayTasks.map((issue, index) => (
                <TaskRow
                  key={issue.id}
                  issue={issue}
                  index={index}
                  busy={busyId === issue.id}
                  onResolve={setResolved}
                  onDelete={deleteTask}
                />
              ))}
            </OverviewBeat>

            <OverviewBeat
              lead={goalsLead}
              onPress={() => router.navigate("/goals")}
            >
              {activeGoals.map((goal, index) => (
                <GoalPreviewRow
                  key={goal.id}
                  goal={goal}
                  first={index === 0}
                />
              ))}
            </OverviewBeat>

            <OverviewBeat
              lead={projectsLead}
              onPress={() => router.navigate("/workspaces")}
            >
              {projects.map((project, index) => (
                <ProjectPreviewRow
                  key={project.id}
                  project={project}
                  openTasks={openTaskCountByProject.get(project.id) ?? 0}
                  first={index === 0}
                />
              ))}
            </OverviewBeat>

            {showFinance ? (
              <OverviewBeat
                lead={
                  financeQuery.isPending && !financeQuery.data
                    ? "This month’s spend."
                    : financeQuery.error
                      ? queryErrorMessage(
                          financeQuery.error,
                          "Couldn’t load spend.",
                        )
                      : financeQuery.data
                        ? `${financeQuery.data.totalSpentLabel} this month.`
                        : "No spend this month."
                }
                onPress={() => router.navigate("/finances")}
              >
                {financeQuery.data ? (
                  <FinanceCaption summary={financeQuery.data} />
                ) : financeQuery.isPending ? (
                  <View className="py-2">
                    <ActivityIndicator
                      color={placeholderColor ?? undefined}
                    />
                  </View>
                ) : null}
              </OverviewBeat>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function OverviewBeat({
  lead,
  onPress,
  children,
}: {
  readonly lead: string;
  readonly onPress?: () => void;
  readonly children?: ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : children != null && children !== false;

  return (
    <View className="mb-6">
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={lead}
          onPress={onPress}
        >
          <Text variant="body">{lead}</Text>
        </Pressable>
      ) : (
        <Text variant="body">{lead}</Text>
      )}
      {hasChildren ? <View className="mt-2">{children}</View> : null}
    </View>
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
    goal.projectName,
    goal.targetDate ? `Target ${goal.targetDate}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={goal.title}
      className={`py-2 active:opacity-80 ${first ? "" : "border-t border-border/40"}`}
      onPress={() =>
        router.push(`/goals/${encodeURIComponent(goal.id)}`)
      }
    >
      <Text variant="body">{goal.title}</Text>
      {meta ? (
        <Text variant="caption" className="mt-0.5">
          {meta}
        </Text>
      ) : null}
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
  const openLabel =
    openTasks === 0
      ? "No open tasks"
      : openTasks === 1
        ? "1 open task"
        : `${String(openTasks)} open tasks`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${project.name}, ${openLabel}`}
      className={`flex-row items-center gap-3 py-2 active:opacity-80 ${first ? "" : "border-t border-border/40"}`}
      onPress={() => router.push(overviewProjectHref(project.id))}
    >
      <Text variant="body" weight="medium" className="min-w-0 flex-1" numberOfLines={1}>
        {project.name}
      </Text>
      <Text variant="caption">{openLabel}</Text>
    </Pressable>
  );
}

function FinanceCaption({
  summary,
}: {
  readonly summary: {
    readonly totalSpentLabel: string;
    readonly groups: readonly { readonly name: string; readonly amount: number }[];
  };
}) {
  const top = [...summary.groups].sort((a, b) => b.amount - a.amount)[0];
  if (!top) {
    return (
      <Text variant="caption" className="py-1">
        No groups yet
      </Text>
    );
  }
  return (
    <Text variant="caption" className="py-1">
      Top: {top.name}
    </Text>
  );
}
