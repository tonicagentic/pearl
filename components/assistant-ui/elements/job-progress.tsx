"use client";

import type { ComponentProps } from "react";
import {
  Ban,
  CheckIcon,
  Loader2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ghostButton, mono, paper } from "./surfaces";

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
  ...props
}: Omit<
  ComponentProps<"div">,
  "title" | "children"
> & {
  title: string;
  stages: readonly JobStage[];
  stageIndex: number;
  stageProgress: number;
  eta: string;
  onCancel?: () => void;
  outcome?: JobOutcome;
  elapsedMs?: number;
}) {
  const finished =
    outcome !== undefined || stageIndex >= stages.length;
  const progress =
    outcome?.status === "success" || (!outcome && stageIndex >= stages.length)
      ? 100
      : weightedProgress(stages, stageIndex, stageProgress);
  const current =
    stages[clamp(Math.floor(stageIndex), 0, Math.max(0, stages.length - 1))];
  const state =
    outcome?.status ??
    (finished ? "success" : "running");

  return (
    <div
      data-slot="job-progress"
      data-state={state}
      className={cn(paper, "flex w-full flex-col gap-3 rounded-2xl p-3.5", className)}
      {...props}
    >
      <div className="flex items-center gap-2.5">
        {state === "success" ? (
          <CheckIcon className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
        ) : state === "failed" ? (
          <XIcon className="text-destructive size-3.5 shrink-0" aria-hidden />
        ) : state === "cancelled" ? (
          <Ban className="text-foreground/35 size-3.5 shrink-0" aria-hidden />
        ) : state === "partial" ? (
          <TriangleAlertIcon className="size-3.5 shrink-0 text-amber-500" aria-hidden />
        ) : (
          <Loader2Icon
            className="text-foreground/35 size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
        )}
        <span className="min-w-0 flex-1 truncate text-[13.5px]">{title}</span>
        <span className={cn(mono, "text-foreground/40 shrink-0 tabular-nums")}>
          {finished && elapsedMs !== undefined
            ? formatElapsed(elapsedMs)
            : outcome
              ? outcome.status
              : eta}
        </span>
        {!finished && onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className={cn(ghostButton, "size-7 shrink-0")}
            aria-label="Cancel job"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>

      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        className="bg-foreground/[0.06] block h-1.5 w-full overflow-hidden rounded-full"
      >
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-300",
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
      </span>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {stages.map((stage, index) => (
            <span
              key={`${stage.name}-${index}`}
              className={cn(
                mono,
                index === Math.floor(stageIndex) && !finished
                  ? "text-foreground/70"
                  : index < stageIndex || finished
                    ? "text-foreground/45"
                    : "text-foreground/25",
              )}
            >
              {stage.name}
            </span>
          ))}
        </div>
        {!finished && current?.description ? (
          <p className="text-foreground/55 text-xs leading-relaxed">
            {current.description}
          </p>
        ) : null}
      </div>

      {outcome?.summary ? (
        <p className="text-foreground/70 text-xs leading-relaxed">
          {outcome.summary}
        </p>
      ) : null}

      <span role="status" className="sr-only">
        {outcome?.summary ??
          current?.description ??
          (finished ? "Job finished" : `Working on ${current?.name ?? "job"}`)}
      </span>
    </div>
  );
}
