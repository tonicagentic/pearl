"use client";

import {
  Children,
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Ban,
  CheckIcon,
  ChevronRightIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";
import {
  elapsedMsForRun,
  formatElapsed,
} from "@/lib/chat/task-elapsed";
import { cn } from "@/lib/utils";
import {
  mono,
  paper,
  ThinkingStatesLabel,
} from "./surfaces";

export type TaskCardState =
  | "working"
  | "waiting"
  | "done"
  | "failed"
  | "cancelled";

const isRenderable = (node: ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== true;

export function TaskStateIcon({
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
        className={cn("text-muted-foreground size-3.5 shrink-0", className)}
      />
    );
  }
  if (state === "working") {
    return (
      <Loader2Icon
        aria-hidden
        className={cn(
          "text-muted-foreground size-3.5 shrink-0 animate-spin motion-reduce:animate-none",
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "border-foreground/35 m-1 size-1.5 shrink-0 rounded-full border",
        className,
      )}
    />
  );
}

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
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  const ms = elapsedMsForRun({
    startedAt,
    settledAt: live ? undefined : settledAtRef.current,
    now,
    live: live || settledAtRef.current !== undefined,
  });
  return ms === undefined ? undefined : formatElapsed(ms);
}

/**
 * Sticky activity caption: keep the last non-empty live line and crossfade
 * updates instead of collapsing the reserved second header line.
 */
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

/**
 * Paper task card matching assistant-ui elements/task-card: one surface with
 * header (state, label, meta, elapsed, chevron), optional activity, actions,
 * transcript, and in-card result.
 */
export function TaskCard({
  label,
  meta,
  activity,
  state,
  startedAt,
  elapsed: elapsedProp,
  actions,
  result,
  open,
  onOpenChange,
  children,
  className,
  ...props
}: Omit<
  ComponentProps<"div">,
  "children" | "label" | "state" | "result" | "open" | "onOpenChange"
> & {
  label: string;
  meta?: string | undefined;
  activity?: string | undefined;
  state: TaskCardState;
  /** Wall-clock start for live elapsed; ignored when `elapsed` is passed. */
  startedAt?: number | undefined;
  elapsed?: string | undefined;
  actions?: ReactNode | undefined;
  result?: ReactNode | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  children?: ReactNode | undefined;
}) {
  const live = state === "working" || state === "waiting";
  const stickyActivity = useStickyActivity(activity, live);
  const timedElapsed = useCardElapsed(startedAt, live);
  const elapsed = elapsedProp ?? timedElapsed;
  const hasTranscript = Children.toArray(children).length > 0;
  const inert = open !== undefined && onOpenChange === undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div
      data-slot="task-card"
      data-state={state}
      className={cn(
        paper,
        "bg-card flex w-full flex-col overflow-hidden rounded-2xl dark:bg-card",
        className,
      )}
      {...props}
    >
      <button
        type="button"
        aria-expanded={hasTranscript ? isOpen : undefined}
        disabled={!hasTranscript || inert}
        onClick={toggle}
        className="hover:enabled:bg-foreground/[0.03] flex w-full flex-col gap-1 px-3.5 py-2.5 text-start transition-colors disabled:cursor-default"
      >
        <div className="flex items-center gap-2.5">
          <TaskStateIcon state={state} />
          <span className="sr-only">{state}</span>
          <span className="text-foreground min-w-0 flex-1 line-clamp-2 text-[13px] leading-snug">
            {label}
          </span>
          {meta !== undefined && (
            <span
              className={cn(
                mono,
                "text-muted-foreground max-w-24 shrink-0 truncate",
              )}
            >
              {meta}
            </span>
          )}
          {elapsed !== undefined && (
            <span
              className={cn(mono, "text-muted-foreground shrink-0 tabular-nums")}
            >
              {elapsed}
            </span>
          )}
          {hasTranscript && (
            <ChevronRightIcon
              aria-hidden
              className={cn(
                "text-muted-foreground size-3 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
                isOpen && "rotate-90",
              )}
            />
          )}
        </div>
        {stickyActivity !== undefined && stickyActivity.length > 0 ? (
          <div className="ps-6 min-h-[1.1rem]">
            <ThinkingStatesLabel
              label={stickyActivity}
              shimmer={live}
              className="text-muted-foreground text-[12.5px] leading-snug"
            />
          </div>
        ) : null}
      </button>
      {isRenderable(actions) && (
        <div
          data-slot="task-card-actions"
          className="border-border/60 border-t px-3.5 py-2.5"
        >
          {actions}
        </div>
      )}
      {hasTranscript && isOpen && (
        <div
          data-slot="task-card-transcript"
          className="border-border/60 flex flex-col gap-2 border-t px-3.5 py-2.5"
        >
          {children}
        </div>
      )}
      {isRenderable(result) && (
        <div
          data-slot="task-card-result"
          className="border-border/60 text-foreground/70 border-t px-3.5 py-2.5 text-xs leading-relaxed"
        >
          {typeof result === "string" || typeof result === "number" ? (
            <div className="line-clamp-2">{result}</div>
          ) : (
            result
          )}
        </div>
      )}
    </div>
  );
}
