import {
  Ban,
  CheckIcon,
  Loader2,
  TriangleAlert,
  XIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { mono, paper } from "./surfaces";

export type JobStage = {
  readonly name: string;
  readonly weight: number;
  readonly description?: string;
};

export type JobOutcome = {
  readonly status: "success" | "partial" | "failed" | "cancelled";
  readonly summary?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function weightedProgress(
  stages: readonly JobStage[],
  stageIndex: number,
  stageProgress: number,
): number {
  const total = stages.reduce((sum, s) => sum + Math.max(0, s.weight), 0) || 1;
  const index = clamp(Math.floor(stageIndex), 0, stages.length);
  if (index >= stages.length) return 100;
  let done = 0;
  for (let i = 0; i < index; i += 1) done += Math.max(0, stages[i]!.weight);
  const current = stages[index];
  if (current) {
    done += Math.max(0, current.weight) * clamp(stageProgress, 0, 1);
  }
  return clamp((done / total) * 100, 0, 100);
}

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (minutes < 60) return rem ? `${minutes}m ${rem}s` : `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

export function JobProgress({
  title,
  stages,
  stageIndex,
  stageProgress,
  eta,
  onCancel,
  outcome,
  elapsedMs,
  className,
}: {
  readonly title: string;
  readonly stages: readonly JobStage[];
  readonly stageIndex: number;
  readonly stageProgress: number;
  readonly eta: string;
  readonly onCancel?: () => void;
  readonly outcome?: JobOutcome;
  readonly elapsedMs?: number;
  readonly className?: string;
}) {
  const finished = outcome !== undefined || stageIndex >= stages.length;
  const progress =
    outcome?.status === "success" || (!outcome && stageIndex >= stages.length)
      ? 100
      : weightedProgress(stages, stageIndex, stageProgress);
  const current =
    stages[clamp(Math.floor(stageIndex), 0, Math.max(0, stages.length - 1))];
  const state = outcome?.status ?? (finished ? "success" : "running");

  return (
    <View
      accessibilityRole="summary"
      className={cn(paper, "w-full flex-col gap-3 rounded-2xl p-3.5", className)}
    >
      <View className="flex-row items-center gap-2.5">
        {state === "success" ? (
          <CheckIcon className="size-3.5 shrink-0 text-emerald-500" />
        ) : state === "failed" ? (
          <XIcon className="size-3.5 shrink-0 text-destructive" />
        ) : state === "cancelled" ? (
          <Ban className="size-3.5 shrink-0 text-foreground/35" />
        ) : state === "partial" ? (
          <TriangleAlert className="size-3.5 shrink-0 text-amber-500" />
        ) : (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-foreground/35" />
        )}
        <Text variant="secondary" tone="default" numberOfLines={1} className="min-w-0 flex-1">
          {title}
        </Text>
        <Text variant="caption" tone="default" className={cn(mono, "shrink-0 opacity-40")}>
          {finished && elapsedMs !== undefined
            ? formatElapsed(elapsedMs)
            : outcome
              ? outcome.status
              : eta}
        </Text>
        {!finished && onCancel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel job"
            onPress={onCancel}
            className="size-7 items-center justify-center rounded-full"
          >
            <XIcon className="size-3.5 text-foreground/45" />
          </Pressable>
        ) : null}
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress) }}
        className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/5"
      >
        <View
          className={cn(
            "h-full rounded-full",
            state === "failed"
              ? "bg-destructive/80"
              : state === "partial"
                ? "bg-amber-500/80"
                : state === "cancelled"
                  ? "bg-foreground/25"
                  : "bg-foreground/55",
          )}
          style={{ width: `${progress}%` }}
        />
      </View>

      <View className="flex-col gap-1.5">
        <View className="flex-row flex-wrap gap-x-2 gap-y-1">
          {stages.map((stage, index) => (
            <Text
              key={`${stage.name}-${index}`}
              variant="caption"
              tone="default"
              className={cn(
                mono,
                index === Math.floor(stageIndex) && !finished
                  ? "opacity-70"
                  : index < stageIndex || finished
                    ? "opacity-45"
                    : "opacity-25",
              )}
            >
              {stage.name}
            </Text>
          ))}
        </View>
        {!finished && current?.description ? (
          <Text variant="caption" tone="default" className="leading-relaxed opacity-55">
            {current.description}
          </Text>
        ) : null}
      </View>

      {outcome?.summary ? (
        <Text variant="caption" tone="default" className="leading-relaxed opacity-70">
          {outcome.summary}
        </Text>
      ) : null}
    </View>
  );
}
