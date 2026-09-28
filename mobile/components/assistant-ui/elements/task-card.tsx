import type { ReactNode } from "react";
import { Ban, CheckIcon, Loader2, XIcon } from "lucide-react-native";
import { Text, View } from "react-native";

import { cn } from "@/lib/utils";
import { mono, paper } from "./surfaces";

// RN port of the web task-card element (components/assistant-ui/elements/
// task-card.tsx): a compact status row for delegated subagent work, with an
// optional result strip. States drive the leading icon.
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
  if (state === "working") {
    return <Loader2 className={cn("size-3.5 shrink-0 animate-spin text-foreground/35", className)} />;
  }
  return (
    <View className={cn("m-1 size-1.5 shrink-0 rounded-full border border-foreground/35", className)} />
  );
}

const isRenderable = (node: ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== true;

export function TaskCard({
  label,
  meta,
  state,
  elapsed,
  result,
  className,
}: {
  readonly label: string;
  readonly meta?: string | undefined;
  readonly state: TaskCardState;
  readonly elapsed?: string | undefined;
  readonly result?: ReactNode | undefined;
  readonly className?: string;
}) {
  return (
    <View
      className={cn(paper, "w-full flex-col overflow-hidden rounded-2xl", className)}
    >
      <View className="flex-row items-center gap-2.5 px-3.5 py-2.5">
        <TaskStateIcon state={state} />
        <Text
          numberOfLines={1}
          className="min-w-0 flex-1 text-[13.5px] text-foreground"
        >
          {label}
        </Text>
        {meta !== undefined && (
          <Text numberOfLines={1} className={cn(mono, "max-w-24 shrink-0 text-foreground/35")}>
            {meta}
          </Text>
        )}
        {elapsed !== undefined && (
          <Text className={cn(mono, "shrink-0 text-foreground/30")}>{elapsed}</Text>
        )}
      </View>
      {isRenderable(result) && (
        <View className="border-t border-border/60 px-3.5 py-2">
          <Text className="text-xs leading-relaxed text-foreground/70">{result}</Text>
        </View>
      )}
    </View>
  );
}
