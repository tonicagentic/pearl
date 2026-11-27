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
import { router, useFocusEffect } from "expo-router";
import {
  Building2Icon,
  CheckIcon,
  HeartIcon,
  LaptopIcon,
  MoreVerticalIcon,
  PaletteIcon,
  PlusIcon,
  TargetIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react-native";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCSSVariable } from "uniwind";

import { usePearlDrawerOptional } from "@/components/navigation/drawer-context";
import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
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
import { startGoalChat } from "@/src/start-goal-chat";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateList() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

const CREATE_AREAS: readonly {
  readonly label: string;
  readonly icon: LucideIcon;
}[] = [
  { label: "Health", icon: HeartIcon },
  { label: "Relationships", icon: UsersIcon },
  { label: "Finance", icon: WalletIcon },
  { label: "Career", icon: Building2Icon },
  { label: "Interests", icon: PaletteIcon },
  { label: "Productivity", icon: LaptopIcon },
];

/** Goals hub: Tracking list + chat-first Create a goal. */
export function GoalsScreen() {
  const queryClient = useQueryClient();
  const { offline } = useNetworkStatus();
  const { isAnonymous } = useAuth();
  const { startNewChatWithMessage } = useChats();
  const drawer = usePearlDrawerOptional();
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

  const openGoalChat = useCallback(
    (area?: string) => {
      startGoalChat({
        isAnonymous,
        startNewChatWithMessage,
        notifyChatSelectedFromDrawer:
          drawer?.notifyChatSelectedFromDrawer ??
          (() => {
            /* drawer optional outside shell */
          }),
        area,
      });
    },
    [drawer?.notifyChatSelectedFromDrawer, isAnonymous, startNewChatWithMessage],
  );

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
    async (goal: GoalDto) => {
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
    },
    [deleteMutation, offline, queryClient, removeGoal],
  );

  const confirmDelete = useCallback(
    (goal: GoalDto) => {
      Alert.alert("Delete goal?", `"${goal.title}" cannot be undone.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteGoal(goal);
          },
        },
      ]);
    },
    [deleteGoal],
  );

  const active = useMemo(
    () => (goals ?? []).filter((goal) => goal.status === "active"),
    [goals],
  );
  const done = useMemo(
    () => (goals ?? []).filter((goal) => goal.status === "done"),
    [goals],
  );

  const bannerError = showActionError
    ? actionError
    : showLoadError
      ? loadError
      : null;

  return (
    <ScreenChrome
      title="Goals"
      leading="drawer"
      actions={[
        {
          label: "New goal",
          systemImage: "plus",
          icon: PlusIcon,
          onPress: () => openGoalChat(),
        },
      ]}
    >
      <View style={{ flex: 1, backgroundColor }}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-0"
          contentContainerStyle={{ paddingBottom: 32 }}
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
              <View className="mb-7">
                <Text variant="body" weight="semibold" className="mb-2">
                  Tracking
                </Text>
                {active.length === 0 ? (
                  <Text variant="body" tone="muted" className="px-1">
                    Nothing is being tracked yet
                  </Text>
                ) : (
                  <>
                    <View className="mb-2.5 flex-row items-center gap-2">
                      <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-500/15">
                        <Icon
                          as={TargetIcon}
                          className="size-3.5 text-blue-500"
                        />
                      </View>
                      <Text
                        variant="secondary"
                        weight="medium"
                        className="text-blue-500"
                      >
                        Goals
                      </Text>
                    </View>
                    <View className="overflow-hidden rounded-2xl bg-muted/35">
                      {active.map((goal, index) => (
                        <View
                          key={goal.id}
                          className={
                            index === 0 ? "" : "border-t border-border/40"
                          }
                        >
                          <GoalRow
                            goal={goal}
                            busy={busyId === goal.id}
                            onToggle={toggleDone}
                            onMore={() => confirmDelete(goal)}
                          />
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>

              {done.length > 0 ? (
                <View className="mb-7">
                  <Text
                    variant="secondary"
                    weight="medium"
                    className="mb-2.5 uppercase tracking-wide"
                  >
                    Done · {done.length}
                  </Text>
                  <View className="overflow-hidden rounded-2xl bg-muted/35">
                    {done.map((goal, index) => (
                      <View
                        key={goal.id}
                        className={
                          index === 0 ? "" : "border-t border-border/40"
                        }
                      >
                        <GoalRow
                          goal={goal}
                          busy={busyId === goal.id}
                          onToggle={toggleDone}
                          onMore={() => confirmDelete(goal)}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <CreateGoalSection onCreate={openGoalChat} />
            </>
          )}
        </ScrollView>
      </View>
    </ScreenChrome>
  );
}

function CreateGoalSection({
  onCreate,
}: {
  readonly onCreate: (area?: string) => void;
}) {
  return (
    <View className="mb-4">
      <Text variant="body" weight="semibold" className="mb-3">
        Create a goal
      </Text>
      <View className="overflow-hidden rounded-2xl bg-muted/35">
        {CREATE_AREAS.map((area, index) => (
          <Pressable
            key={area.label}
            accessibilityRole="button"
            accessibilityLabel={`Create a ${area.label} goal`}
            className={`flex-row items-center gap-3 px-3.5 py-3.5 active:bg-muted/50 ${index === 0 ? "" : "border-t border-border/40"}`}
            onPress={() => onCreate(area.label)}
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
              <Icon as={area.icon} className="size-4 text-foreground" />
            </View>
            <Text variant="body" weight="medium" className="min-w-0 flex-1">
              {area.label}
            </Text>
            <Icon as={PlusIcon} className="size-4 text-muted-foreground" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function GoalRow({
  goal,
  busy,
  onToggle,
  onMore,
}: {
  readonly goal: GoalDto;
  readonly busy: boolean;
  readonly onToggle: (goal: GoalDto) => Promise<void>;
  readonly onMore: () => void;
}) {
  const done = goal.status === "done";
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;
  const caption = [
    goal.projectName,
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
        className={`mt-0.5 h-7 w-7 items-center justify-center rounded-md border ${done ? "border-border bg-muted" : "border-foreground/30"}`}
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${goal.title}`}
        className="min-w-0 flex-1 active:opacity-80"
        onPress={() =>
          router.push(`/goals/${encodeURIComponent(goal.id)}`)
        }
      >
        <Text
          variant="body"
          tone={done ? "muted" : "default"}
          className={done ? "line-through" : undefined}
        >
          {goal.title}
        </Text>
        {goal.notes ? (
          <Text variant="secondary" className="mt-1" numberOfLines={3}>
            {goal.notes}
          </Text>
        ) : null}
        {caption ? (
          <Text variant="caption" className="mt-1.5">
            {caption}
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Goal options"
        className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
        onPress={onMore}
      >
        <Icon as={MoreVerticalIcon} className="size-4 text-muted-foreground" />
      </Pressable>
    </View>
  );
}
