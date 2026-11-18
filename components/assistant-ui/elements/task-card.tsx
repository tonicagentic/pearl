"use client";

import type { ComponentProps, ReactNode } from "react";
import { Ban, CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { mono, stepEnter, threadMeta } from "./surfaces";

export type TaskCardState =
  | "working"
  | "waiting"
  | "done"
  | "failed"
  | "cancelled";

const isRenderable = (node: ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== true;

function TaskStateMark({
  state,
  className,
}: {
  state: TaskCardState;
  className?: string;
}) {
  if (state === "done") {
    return (
      <CheckIcon
        aria-hidden
        className={cn("size-3.5 shrink-0 text-emerald-500", className)}
      />
    );
  }
  if (state === "failed") {
    return (
      <XIcon
        aria-hidden
        className={cn("text-destructive size-3.5 shrink-0", className)}
      />
    );
  }
  if (state === "cancelled") {
    return (
      <Ban
        aria-hidden
        className={cn("text-foreground/35 size-3.5 shrink-0", className)}
      />
    );
  }
  // Live / waiting: double-colon mark matching the Cursor subagent row.
  return (
    <span
      aria-hidden
      className={cn(
        mono,
        "text-foreground/35 w-3.5 shrink-0 text-center leading-none",
        className,
      )}
    >
      ::
    </span>
  );
}

/**
 * Flat in-transcript subagent row: `::` mark, truncated title, model label,
 * optional activity line, and an optional settled result strip. Not a card.
 */
export function TaskCard({
  label,
  modelLabel,
  activity,
  state,
  result,
  className,
  ...props
}: Omit<
  ComponentProps<"div">,
  "children" | "label" | "state" | "result"
> & {
  label: string;
  modelLabel?: string | undefined;
  activity?: string | undefined;
  state: TaskCardState;
  result?: ReactNode | undefined;
}) {
  return (
    <div
      data-slot="task-card"
      data-state={state}
      className={cn(stepEnter, "flex w-full flex-col gap-0.5", className)}
      {...props}
    >
      <div className={cn("flex items-baseline gap-2", threadMeta)}>
        <TaskStateMark state={state} className="translate-y-[1px]" />
        <span className="sr-only">{state}</span>
        <span className="min-w-0 flex-1 truncate text-[13px]">{label}</span>
        {modelLabel !== undefined && (
          <span
            className={cn(
              mono,
              "text-foreground/35 max-w-[40%] shrink-0 truncate",
            )}
          >
            {modelLabel}
          </span>
        )}
      </div>
      {activity !== undefined && activity.length > 0 && (
        <div className={cn("ps-5.5", threadMeta)}>
          <span className="text-foreground/45 text-[12.5px] leading-snug">
            {activity}
          </span>
        </div>
      )}
      {isRenderable(result) && (
        <div
          data-slot="task-card-result"
          className="border-border/60 mt-1.5 max-w-xl overflow-hidden rounded-2xl border"
        >
          <div className="px-3.5 py-2.5">
            {typeof result === "string" || typeof result === "number" ? (
              <div className="text-foreground/70 text-xs leading-relaxed">
                {result}
              </div>
            ) : (
              result
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** @deprecated Prefer TaskCard; kept for any external TaskStateIcon imports. */
export function TaskStateIcon({
  state,
  className,
}: {
  state: TaskCardState;
  className?: string;
}) {
  return <TaskStateMark state={state} className={className} />;
}
