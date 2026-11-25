import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  UIManager,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { CheckIcon, PlusIcon, Trash2Icon } from "lucide-react-native";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCSSVariable } from "uniwind";

import { CreateGoalModal } from "@/components/goals/create-goal-modal";
import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
  deleteGoalRequest,
  fetchAllGoals,
  updateGoalRequest,
  type GoalDto,
} from "@/src/goals-client";
import { useNetworkStatus } from "@/src/network-status";
import {
  queryErrorMessage,
  queryKeys,
  showQueryErrorBanner,
} from "@/src/query-client";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateList() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

/** Goals hub: Active / Done with optional project filing. */
export function GoalsScreen() {
  const queryClient = useQueryClient();
  const { offline } = useNetworkStatus();
  const [composerOpen, setComposerOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const goalsQuery = useQuery({
    queryKey: queryKeys.goals,
    queryFn: fetchAllGoals,
  });

  useFocusEffect(
    useCallback(() => {
      void goalsQuery.refetch();
    }, [goalsQuery.refetch]),
  );

  const goals = goalsQuery.data ?? null;
  const loadError = goalsQuery.error;
  const showLoadError = showQueryErrorBanner(offline, loadError);
  const showActionError = showQueryErrorBanner(offline, actionError);

  const invalidateGoalsAndProjects = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.goals });
    void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
  }, [queryClient]);

  const patchGoal = useCallback(
    (updated: GoalDto) => {
      animateList();
      queryClient.setQueryData<readonly GoalDto[]>(queryKeys.goals, (current) =>
        current
          ? current.map((row) => (row.id === updated.id ? updated : row))
          : current,
      );
    },
    [queryClient],
  );

  const removeGoal = useCallback(
    (id: string) => {
      animateList();
      queryClient.setQueryData<readonly GoalDto[]>(queryKeys.goals, (current) =>
        current ? current.filter((row) => row.id !== id) : current,
      );
    },
    [queryClient],
  );

  const updateMutation = useMutation({
    mutationFn: ({
      goalId,
      input,
    }: {
      goalId: string;
      input: Parameters<typeof updateGoalRequest>[1];
    }) => updateGoalRequest(goalId, input),
    onSuccess: (updated) => {
      patchGoal(updated);
      invalidateGoalsAndProjects();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGoalRequest,
    onSuccess: () => {
      invalidateGoalsAndProjects();
    },
  });

  const toggleDone = useCallback(
    async (goal: GoalDto) => {
      setBusyId(goal.id);
      setActionError(null);
      const nextStatus = goal.status === "done" ? "active" : "done";
      const optimistic: GoalDto = { ...goal, status: nextStatus };
      patchGoal(optimistic);
      try {
        await updateMutation.mutateAsync({
          goalId: goal.id,
          input: { status: nextStatus },
        });
      } catch (cause) {
        patchGoal(goal);
        if (showQueryErrorBanner(offline, cause)) {
          setActionError(
            queryErrorMessage(cause, "Failed to update the goal."),
          );
        }
      } finally {
        setBusyId(null);
      }
    },
    [offline, patchGoal, updateMutation],
  );

  const deleteGoal = useCallback(
    (goal: GoalDto) => {
      Alert.alert("Delete goal?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusyId(goal.id);
              setActionError(null);
              const snapshot = queryClient.getQueryData<readonly GoalDto[]>(
                queryKeys.goals,
              );
              removeGoal(goal.id);
              try {
                await deleteMutation.mutateAsync(goal.id);
              } catch (cause) {
                if (snapshot) {
                  queryClient.setQueryData(queryKeys.goals, snapshot);
                }
                if (showQueryErrorBanner(offline, cause)) {
                  setActionError(
                    queryErrorMessage(cause, "Failed to delete the goal."),
                  );
                }
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ]);
    },
    [deleteMutation, offline, queryClient, removeGoal],
  );

  const active = useMemo(
    () => (goals ?? []).filter((goal) => goal.status === "active"),
    [goals],
  );
  const done = useMemo(
    () => (goals ?? []).filter((goal) => goal.status === "done"),
    [goals],
  );

  const bannerError = showActionError ? actionError : showLoadError ? loadError : null;

  return (
    <ScreenChrome
      title="Goals"
      leading="drawer"
      actions={[
        {
          label: "New goal",
          systemImage: "plus",
          icon: PlusIcon,
          onPress: () => setComposerOpen(true),
        },
      ]}
    >
      <View style={{ flex: 1, backgroundColor }}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-0"
          contentContainerStyle={{ paddingBottom: 24 }}
          contentInsetAdjustmentBehavior="automatic"
        >
          {bannerError ? (
            <Pressable
              accessibilityRole="button"
              className="mb-4 rounded-2xl bg-destructive/10 px-4 py-3"
              onPress={() => {
                setActionError(null);
                void goalsQuery.refetch();
              }}
            >
              <Text variant="secondary" tone="destructive">
                {typeof bannerError === "string"
                  ? bannerError
                  : queryErrorMessage(bannerError, "Failed to load goals.")}
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

          {goals === null && goalsQuery.isPending ? (
            <ActivityIndicator color={placeholderColor ?? undefined} />
          ) : (
            <>
              <GoalGroup
                title="Active"
                goals={active}
                busyId={busyId}
                onToggle={toggleDone}
                onDelete={deleteGoal}
                empty="No active goals"
              />
              {done.length > 0 ? (
                <GoalGroup
                  title="Done"
                  goals={done}
                  busyId={busyId}
                  onToggle={toggleDone}
                  onDelete={deleteGoal}
                />
              ) : null}
            </>
          )}
        </ScrollView>

        <CreateGoalModal
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          onCreated={() => {
            animateList();
            invalidateGoalsAndProjects();
            setComposerOpen(false);
          }}
        />
      </View>
    </ScreenChrome>
  );
}

function GoalGroup({
  title,
  goals,
  busyId,
  onToggle,
  onDelete,
  empty,
}: {
  readonly title: string;
  readonly goals: readonly GoalDto[];
  readonly busyId: string | null;
  readonly onToggle: (goal: GoalDto) => Promise<void>;
  readonly onDelete: (goal: GoalDto) => void;
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
        {goals.length > 0 ? ` · ${goals.length}` : ""}
      </Text>
      {goals.length === 0 ? (
        empty ? (
          <Text variant="body" tone="muted" className="px-1">
            {empty}
          </Text>
        ) : null
      ) : (
        <View className="overflow-hidden rounded-2xl bg-muted/35">
          {goals.map((goal, index) => (
            <View
              key={goal.id}
              className={index === 0 ? "" : "border-t border-border/40"}
            >
              <GoalRow
                goal={goal}
                busy={busyId === goal.id}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function GoalRow({
  goal,
  busy,
  onToggle,
  onDelete,
}: {
  readonly goal: GoalDto;
  readonly busy: boolean;
  readonly onToggle: (goal: GoalDto) => Promise<void>;
  readonly onDelete: (goal: GoalDto) => void;
}) {
  const done = goal.status === "done";
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const subtitle = goal.projectName ?? "No project";
  const meta = [
    subtitle,
    goal.targetDate ? `Target ${goal.targetDate}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="flex-row items-start gap-3 px-3.5 py-3.5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={done ? "Reopen goal" : "Complete goal"}
        disabled={busy}
        className={`mt-0.5 h-7 w-7 items-center justify-center rounded-full border ${done ? "border-border bg-muted" : "border-foreground/30"}`}
        onPress={() => void onToggle(goal)}
      >
        {busy ? (
          <ActivityIndicator
            size="small"
            color={placeholderColor ?? undefined}
          />
        ) : done ? (
          <Icon as={CheckIcon} className="size-4 text-foreground" />
        ) : null}
      </Pressable>
      <View className="min-w-0 flex-1">
        <Text
          variant="body"
          tone={done ? "muted" : "default"}
          className={done ? "line-through" : undefined}
        >
          {goal.title}
        </Text>
        <Text variant="caption" className="mt-1.5">
          {meta}
        </Text>
        {goal.notes ? (
          <Text variant="secondary" className="mt-1" numberOfLines={2}>
            {goal.notes}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete goal"
        className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
        onPress={() => onDelete(goal)}
      >
        <Icon as={Trash2Icon} className="size-4 text-muted-foreground" />
      </Pressable>
    </View>
  );
}