import type { ReactNode } from "react";
import { Ban, CheckIcon, XIcon } from "lucide-react-native";
import { Platform, Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { mono, stepEnter, useMotion } from "./surfaces";

// RN port of the web task-card element: a flat status row for delegated
// subagent work. States drive the leading mark. Only the header is pressable
// so settled receipt controls stay interactive.

export type TaskCardState =
  | "working"
  | "waiting"
  | "done"
  | "failed"
  | "cancelled";

export function TaskStateIcon({
  state,
  className,
}: {
  readonly state: TaskCardState;
  readonly className?: string;
}) {
  if (state === "done") {
    return (
      <CheckIcon className={cn("size-3.5 shrink-0 text-emerald-500", className)} />
    );
  }
  if (state === "failed") {
    return <XIcon className={cn("size-3.5 shrink-0 text-destructive", className)} />;
  }
  if (state === "cancelled") {
    return <Ban className={cn("size-3.5 shrink-0 text-foreground/35", className)} />;
  }
  return (
    <Text
      variant="caption"
      tone="default"
      className={cn(mono, "w-3.5 shrink-0 text-center opacity-35", className)}
    >
      ::
    </Text>
  );
}

const isRenderable = (node: ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== true;

function TaskHeader({
  label,
  modelLabel,
  activity,
  state,
  onPress,
}: {
  readonly label: string;
  readonly modelLabel?: string | undefined;
  readonly activity?: string | undefined;
  readonly state: TaskCardState;
  readonly onPress?: () => void;
}) {
  const body = (
    <View className="flex-col gap-0.5">
      <View className="flex-row items-baseline gap-2">
        <TaskStateIcon state={state} />
        <Text
          variant="secondary"
          tone="default"
          numberOfLines={1}
          className="min-w-0 flex-1 text-[13px]"
        >
          {label}
        </Text>
        {modelLabel !== undefined && (
          <Text
            variant="caption"
            tone="default"
            numberOfLines={1}
            className={cn(mono, "max-w-[40%] shrink-0 opacity-35")}
          >
            {modelLabel}
          </Text>
        )}
      </View>
      {activity !== undefined && activity.length > 0 ? (
        <Text
          variant="caption"
          tone="default"
          numberOfLines={2}
          className="ps-5.5 leading-snug opacity-45"
        >
          {activity}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${modelLabel ?? label} transcript`}
      onPress={onPress}
    >
      {body}
    </Pressable>
  );
}

export function TaskCard({
  label,
  modelLabel,
  activity,
  state,
  result,
  className,
  onPress,
}: {
  readonly label: string;
  readonly modelLabel?: string | undefined;
  readonly activity?: string | undefined;
  readonly state: TaskCardState;
  readonly result?: ReactNode | undefined;
  readonly className?: string;
  readonly onPress?: () => void;
}) {
  const motion = useMotion();
  const nativeMotion = motion && Platform.OS !== "web";
  return (
    <Animated.View
      entering={nativeMotion ? stepEnter : undefined}
      className={cn("w-full flex-col gap-0.5", className)}
    >
      <TaskHeader
        label={label}
        modelLabel={modelLabel}
        activity={activity}
        state={state}
        onPress={onPress}
      />
      {isRenderable(result) && (
        <View
          data-slot="task-card-result"
          className="mt-1.5 overflow-hidden rounded-2xl border border-border/60"
        >
          <View className="px-3.5 py-2.5">
            {typeof result === "string" || typeof result === "number" ? (
              <Text
                variant="caption"
                tone="default"
                className="leading-relaxed opacity-70"
              >
                {result}
              </Text>
            ) : (
              result
            )}
          </View>
        </View>
      )}
    </Animated.View>
  );
}
