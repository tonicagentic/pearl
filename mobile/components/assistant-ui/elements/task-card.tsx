import type { ReactNode } from "react";
import { Ban, CheckIcon, Loader2, XIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { mono, paper } from "./surfaces";

// RN port of the web task-card element (components/assistant-ui/elements/
// task-card.tsx): a compact status row for delegated subagent work, with an
// optional result strip. States drive the leading icon. Only the header is
// pressable so receipt controls (links, preview, video) stay interactive.
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
    return <CheckIcon className={cn("size-3.5 shrink-0 text-emerald-500", className)} />;
  }
  if (state === "failed") {
    return <XIcon className={cn("size-3.5 shrink-0 text-destructive", className)} />;
  }
  if (state === "cancelled") {
    return <Ban className={cn("size-3.5 shrink-0 text-foreground/35", className)} />;
  }
  if (state === "working" || state === "waiting") {
    return <Loader2 className={cn("size-3.5 shrink-0 animate-spin text-foreground/35", className)} />;
  }
  return (
    <View className={cn("m-1 size-1.5 shrink-0 rounded-full border border-foreground/35", className)} />
  );
}

const isRenderable = (node: ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== true;

function TaskHeader({
  label,
  meta,
  state,
  elapsed,
  onPress,
}: {
  readonly label: string;
  readonly meta?: string | undefined;
  readonly state: TaskCardState;
  readonly elapsed?: string | undefined;
  readonly onPress?: () => void;
}) {
  const row = (
    <View className="flex-row items-center gap-2.5 px-3.5 py-2.5">
      <TaskStateIcon state={state} />
      <Text variant="secondary" tone="default" numberOfLines={1} className="min-w-0 flex-1">
        {label}
      </Text>
      {meta !== undefined && (
        <Text
          variant="caption"
          tone="default"
          numberOfLines={1}
          className={cn(mono, "max-w-24 shrink-0 opacity-35")}
        >
          {meta}
        </Text>
      )}
      {elapsed !== undefined && (
        <Text
          variant="caption"
          tone="default"
          className={cn(mono, "shrink-0 opacity-30")}
        >
          {elapsed}
        </Text>
      )}
    </View>
  );

  if (!onPress) return row;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${meta ?? label} transcript`}
      onPress={onPress}
    >
      {row}
    </Pressable>
  );
}

export function TaskCard({
  label,
  meta,
  state,
  elapsed,
  result,
  className,
  onPress,
}: {
  readonly label: string;
  readonly meta?: string | undefined;
  readonly state: TaskCardState;
  readonly elapsed?: string | undefined;
  readonly result?: ReactNode | undefined;
  readonly className?: string;
  readonly onPress?: () => void;
}) {
  return (
    <View
      className={cn(
        paper,
        "w-full flex-col overflow-hidden rounded-2xl",
        (state === "working" || state === "waiting") && "opacity-90",
        className,
      )}
    >
      <TaskHeader
        label={label}
        meta={meta}
        state={state}
        elapsed={elapsed}
        onPress={onPress}
      />
      {isRenderable(result) && (
        <View data-slot="task-card-result" className="border-t border-border/60 px-3.5 py-2.5">
          {typeof result === "string" || typeof result === "number" ? (
            <Text variant="caption" tone="default" className="leading-relaxed opacity-70">
              {result}
            </Text>
          ) : (
            result
          )}
        </View>
      )}
    </View>
  );
}
