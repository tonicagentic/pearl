import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Ban,
  CheckIcon,
  ChevronRightIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react-native";
import { Platform, Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { Text } from "@/components/ui/text";
import {
  elapsedMsForRun,
  formatElapsed,
} from "../../../../lib/chat/task-elapsed";
import { cn } from "@/lib/utils";
import {
  mono,
  paper,
  stepEnter,
  ThinkingStatesLabel,
  useMotion,
} from "./surfaces";

// RN port of the web task-card element: one paper surface for delegated
// subagent work. Header opens the transcript sheet; result stays in-card.

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
    return (
      <XIcon className={cn("size-3.5 shrink-0 text-destructive", className)} />
    );
  }
  if (state === "cancelled") {
    return (
      <Ban className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />
    );
  }
  if (state === "working") {
    return (
      <Loader2Icon
        className={cn("size-3.5 shrink-0 animate-spin text-muted-foreground", className)}
      />
    );
  }
  return (
    <View
      className={cn(
        "m-1 size-1.5 shrink-0 rounded-full border border-foreground/35",
        className,
      )}
    />
  );
}

const isRenderable = (node: ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== true;

function useCardElapsed(
  startedAt: number | undefined,
  live: boolean,
): string | undefined {
  const [now, setNow] = useState(() => Date.now());
  const settledAtRef = useRef<number | undefined>(undefined);

  if (live) {
    settledAtRef.current = undefined;
  } else if (
    settledAtRef.current === undefined &&
    startedAt !== undefined
  ) {
    settledAtRef.current = Date.now();
  }

  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);

  const ms = elapsedMsForRun({
    startedAt,
    settledAt: live ? undefined : settledAtRef.current,
    now,
    live: live || settledAtRef.current !== undefined,
  });
  return ms === undefined ? undefined : formatElapsed(ms);
}

function useStickyActivity(
  activity: string | undefined,
  live: boolean,
): string | undefined {
  const lastRef = useRef<string | undefined>(undefined);
  if (live && activity && activity.length > 0) {
    lastRef.current = activity;
  }
  if (!live) {
    lastRef.current = undefined;
    return undefined;
  }
  return activity && activity.length > 0 ? activity : lastRef.current;
}

export function TaskCard({
  label,
  meta,
  activity,
  state,
  startedAt,
  elapsed: elapsedProp,
  result,
  className,
  onPress,
  expandable = false,
  animateEnter = false,
}: {
  readonly label: string;
  readonly meta?: string | undefined;
  readonly activity?: string | undefined;
  readonly state: TaskCardState;
  readonly startedAt?: number | undefined;
  readonly elapsed?: string | undefined;
  readonly result?: ReactNode | undefined;
  readonly className?: string;
  readonly onPress?: () => void;
  /** Shows a chevron when the header opens a transcript. */
  readonly expandable?: boolean;
  /** Entering motion only on first mount of a new call id. */
  readonly animateEnter?: boolean;
}) {
  const motion = useMotion();
  const nativeMotion = motion && Platform.OS !== "web" && animateEnter;
  const live = state === "working" || state === "waiting";
  const stickyActivity = useStickyActivity(activity, live);
  const timedElapsed = useCardElapsed(startedAt, live);
  const elapsed = elapsedProp ?? timedElapsed;
  const pressable = onPress != null;

  const header = (
    <View className="flex-col gap-1 px-3.5 py-2.5">
      <View className="flex-row items-center gap-2.5">
        <TaskStateIcon state={state} />
        <Text
          variant="secondary"
          tone="default"
          numberOfLines={2}
          className="min-w-0 flex-1 text-[13px] leading-snug"
        >
          {label}
        </Text>
        {meta !== undefined && (
          <Text
            variant="caption"
            tone="default"
            numberOfLines={1}
            className={cn(mono, "max-w-24 shrink-0 opacity-55")}
          >
            {meta}
          </Text>
        )}
        {elapsed !== undefined && (
          <Text
            variant="caption"
            tone="default"
            className={cn(mono, "shrink-0 tabular-nums opacity-55")}
          >
            {elapsed}
          </Text>
        )}
        {(expandable || pressable) && (
          <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" />
        )}
      </View>
      {stickyActivity !== undefined && stickyActivity.length > 0 ? (
        <View className="min-h-[1.1rem] ps-6">
          <ThinkingStatesLabel
            label={stickyActivity}
            shimmer={live}
            className="opacity-55"
            textClassName="text-[12.5px] leading-snug"
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <Animated.View
      entering={nativeMotion ? stepEnter : undefined}
      data-slot="task-card"
      className={cn(
        paper,
        "w-full overflow-hidden rounded-2xl bg-card dark:bg-card",
        className,
      )}
    >
      {pressable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${meta ?? label} transcript`}
          onPress={onPress}
        >
          {header}
        </Pressable>
      ) : (
        header
      )}
      {isRenderable(result) && (
        <View
          data-slot="task-card-result"
          className="border-t border-border/60 px-3.5 py-2.5"
        >
          {typeof result === "string" || typeof result === "number" ? (
            <Text
              variant="caption"
              tone="default"
              numberOfLines={2}
              className="leading-relaxed opacity-70"
            >
              {result}
            </Text>
          ) : (
            result
          )}
        </View>
      )}
    </Animated.View>
  );
}
