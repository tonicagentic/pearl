import { Alert, Pressable, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import { router } from "expo-router";

import { TaskCompleteControl } from "@/components/tasks/task-complete-control";
import { Text } from "@/components/ui/text";
import type { IssueDto } from "@/src/issues-client";

/** Single task row with Things-style complete control. */
export function TaskRow({
  issue,
  busy,
  onResolve,
  onDelete,
  index = 0,
}: {
  readonly issue: IssueDto;
  readonly busy: boolean;
  readonly onResolve: (issue: IssueDto, resolved: boolean) => void;
  readonly onDelete: (issue: IssueDto) => void;
  readonly index?: number;
}) {
  const resolved = issue.status === "resolved";
  const today = new Date().toISOString().slice(0, 10);
  const meta = [
    issue.dueDate
      ? `${issue.dueDate < today ? "Overdue" : "Due"} ${issue.dueDate}`
      : null,
    issue.reviewDate ? `Review ${issue.reviewDate}` : null,
    issue.state === "dormant" ? "Someday" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutUp.duration(180)}
      layout={LinearTransition.springify().damping(22)}
      className={index === 0 ? "" : "border-t border-border/40"}
    >
      <View className="flex-row items-start gap-3 px-3.5 py-3.5">
        <TaskCompleteControl
          resolved={resolved}
          busy={busy}
          onComplete={() => onResolve(issue, true)}
          onReopen={() => onResolve(issue, false)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${issue.title}`}
          className="min-w-0 flex-1"
          onPress={() =>
            router.push(`/tasks/${encodeURIComponent(issue.id)}`)
          }
          onLongPress={() => {
            Alert.alert("Delete task?", "This cannot be undone.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => onDelete(issue),
              },
            ]);
          }}
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
      </View>
    </Animated.View>
  );
}
