"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  collapsePanel,
  ShimmerLabel,
  stepEnter,
  SwapLabel,
  threadDiffAdd,
  threadDiffRemove,
  threadMeta,
  threadText,
} from "./surfaces";

export interface TimelineStep {
  verb: string;
  chip: string;
  /** Optional body shown when the step is expanded (e.g. reasoning text). */
  detail?: string;
  /** The file this step touched; set when the chip opens the canvas. */
  filePath?: string;
}

export interface TimelineStat {
  file: string;
  added?: number;
  removed?: number;
  /** The touched path; set when the chip opens the canvas. */
  filePath?: string;
}

export interface ToolTimelineProps {
  steps: readonly TimelineStep[];
  visibleSteps: number;
  streaming: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restingLabel: string;
  activeLabel: string;
  stats: TimelineStat[];
  /** Opens a referenced file on the canvas; set when the chat can resolve it. */
  onOpenFile?: (path: string) => void;
  /** Elapsed badge: live while streaming, the settled duration after. */
  elapsed?: string;
  className?: string;
}

const rowClasses = cn(
  stepEnter,
  "flex min-h-6 items-center gap-1.5 py-0.5",
  threadMeta,
);

function StepRow({
  step,
  index,
  active,
  expanded,
  onToggle,
  onOpenFile,
  elapsed,
}: {
  step: TimelineStep;
  index: number;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpenFile?: (path: string) => void;
  /** Shown beside Thought/Thinking on single-step turns. */
  elapsed?: string;
}) {
  const expandable = typeof step.detail === "string" && step.detail.length > 0;
  // Streaming steps read progressive ("Thinking"); settled ones past tense.
  const verb = active && step.verb === "Thought" ? "Thinking" : step.verb;
  const showChip = step.chip.length > 0;

  const row = (
    <div
      key={`step-${index}-${step.verb}-${step.chip}`}
      className={cn(
        rowClasses,
        expandable &&
          "cursor-pointer rounded-md outline-none hover:text-foreground/70 focus-visible:text-foreground/70",
      )}
      {...(expandable
        ? {
            role: "button",
            tabIndex: 0,
            "aria-expanded": expanded,
            onClick: onToggle,
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onToggle();
              }
            },
          }
        : {})}
    >
      <ShimmerLabel
        active={active}
        className="relative inline-block shrink-0 text-muted-foreground"
      >
        {verb}
      </ShimmerLabel>
      {elapsed !== undefined && (
        <span className="tabular-nums opacity-80">{elapsed}</span>
      )}
      {/* File chips open the canvas; long commands/patterns truncate. */}
      {showChip && step.filePath && onOpenFile ? (
        <button
          type="button"
          title={`Open ${step.filePath}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenFile(step.filePath!);
          }}
          className="text-muted-foreground hover:text-foreground/80 min-w-0 max-w-full cursor-pointer truncate transition-colors outline-none"
        >
          {step.chip}
        </button>
      ) : showChip ? (
        <span className="text-muted-foreground min-w-0 truncate">{step.chip}</span>
      ) : null}
      {expandable && (
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 opacity-50 transition-transform duration-200 motion-reduce:transition-none",
            expanded && "rotate-180",
          )}
        />
      )}
    </div>
  );

  if (!expandable) return row;

  return (
    <>
      {row}
      {expanded && (
        <div
          className={cn(
            "text-muted-foreground mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap select-text",
            threadText,
          )}
        >
          {step.detail}
        </div>
      )}
    </>
  );
}

function StatLine({
  stats,
  onOpenFile,
}: {
  stats: TimelineStat[];
  onOpenFile?: (path: string) => void;
}) {
  if (stats.length === 0) return null;

  const totalAdded = stats.reduce((sum, stat) => sum + (stat.added ?? 0), 0);
  const totalRemoved = stats.reduce((sum, stat) => sum + (stat.removed ?? 0), 0);
  const files = stats.length;
  const summary = `Edited ${files} file${files === 1 ? "" : "s"}`;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-0.5 py-0.5", threadMeta)}>
      <span className="min-w-0 truncate">{summary}</span>
      {(totalAdded > 0 || totalRemoved > 0) && (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          {totalAdded > 0 && <span className={threadDiffAdd}>+{totalAdded}</span>}
          {totalRemoved > 0 && (
            <span className={threadDiffRemove}>-{totalRemoved}</span>
          )}
        </span>
      )}
      {stats.some((stat) => stat.filePath) && onOpenFile ? (
        <span className="sr-only">
          {stats
            .filter((stat) => stat.filePath)
            .map((stat) => stat.file)
            .join(", ")}
        </span>
      ) : null}
    </div>
  );
}

export function ToolTimeline({
  steps,
  visibleSteps,
  streaming,
  open,
  onOpenChange,
  restingLabel,
  activeLabel,
  stats,
  onOpenFile,
  elapsed,
  className,
}: ToolTimelineProps) {
  const [expandedSteps, setExpandedSteps] = useState<ReadonlySet<number>>(
    () => new Set(),
  );

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // A single step needs no collapse chrome: render it inline (still
  // expandable if it carries a detail).
  if (steps.length === 1) {
    const step = steps[0];
    const stepElapsed = step.verb === "Thought" ? elapsed : undefined;
    return (
      <div data-slot="tool-timeline" className={cn("w-full", className)}>
        <StepRow
          step={step}
          index={0}
          active={streaming}
          expanded={expandedSteps.has(0)}
          onToggle={() => toggleStep(0)}
          onOpenFile={onOpenFile}
          elapsed={stepElapsed}
        />
        <StatLine stats={stats} onOpenFile={onOpenFile} />
      </div>
    );
  }

  const settledWithDuration =
    !streaming && elapsed !== undefined && restingLabel.startsWith("Worked");

  return (
    <Collapsible
      data-slot="tool-timeline"
      open={open}
      onOpenChange={onOpenChange}
      className={cn("w-full", className)}
    >
      <CollapsibleTrigger
        className={cn(
          "group/trigger hover:text-foreground/70 flex items-center gap-1 rounded-md py-0.5 transition-colors outline-none",
          threadMeta,
        )}
      >
        <SwapLabel
          active={streaming ? 0 : 1}
          className="text-start"
        >
          <ShimmerLabel
            active={streaming}
            className="relative inline-block"
          >
            {elapsed ? `${activeLabel} ${elapsed}` : activeLabel}
          </ShimmerLabel>
          <>{restingLabel}</>
        </SwapLabel>
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 opacity-50 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            "group-data-open/trigger:rotate-180 group-data-panel-open/trigger:rotate-180",
          )}
        />
        {/* Keep a hidden duration for accessibility when the resting label already includes it. */}
        {settledWithDuration ? <span className="sr-only">{elapsed}</span> : null}
      </CollapsibleTrigger>
      <CollapsibleContent className={cn(collapsePanel, "outline-none")}>
        <div className="flex flex-col gap-1 pt-1.5">
          {steps
            .slice(0, Math.max(0, Math.min(visibleSteps, steps.length)))
            .map((step, index, shown) => (
              <StepRow
                key={`step-${index}-${step.verb}-${step.chip}`}
                step={step}
                index={index}
                active={streaming && index === shown.length - 1}
                expanded={expandedSteps.has(index)}
                onToggle={() => toggleStep(index)}
                onOpenFile={onOpenFile}
              />
            ))}
          <StatLine stats={stats} onOpenFile={onOpenFile} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
