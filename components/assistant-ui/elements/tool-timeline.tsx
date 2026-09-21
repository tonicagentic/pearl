"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, type LucideIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { collapsePanel, mono, ShimmerLabel, SwapLabel } from "./surfaces";

export interface TimelineStep {
  verb: string;
  chip: string;
  icon: LucideIcon;
  /** Optional body shown when the step is expanded (e.g. reasoning text). */
  detail?: string;
}

export interface TimelineStat {
  file: string;
  added?: number;
  removed?: number;
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
  /** Live elapsed badge shown next to the active label while streaming. */
  elapsed?: string;
  className?: string;
}

const rowClasses =
  "fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-foreground/55 flex items-center gap-2 text-[13.5px] duration-300";

function StepRow({
  step,
  index,
  streaming,
  active,
  expanded,
  onToggle,
}: {
  step: TimelineStep;
  index: number;
  streaming: boolean;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = step.icon;
  const expandable = typeof step.detail === "string" && step.detail.length > 0;
  // Streaming steps read progressive ("Thinking"); settled ones past tense.
  const verb =
    active && step.verb === "Thought" ? "Thinking" : step.verb;

  const row = (
    <div
      key={`step-${index}-${step.chip}`}
      className={cn(
        rowClasses,
        expandable &&
          "cursor-pointer rounded-md outline-none hover:text-foreground/90 focus-visible:text-foreground/90",
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
      <Icon className="text-foreground/35 size-3.5 shrink-0" />
      <ShimmerLabel
        active={active}
        className="relative inline-block leading-none"
      >
        {verb}
      </ShimmerLabel>
      <span className="bg-foreground/[0.06] text-foreground/70 rounded-md px-1.5 py-0.5 font-mono text-[11px]">
        {step.chip}
      </span>
      {expandable && (
        <ChevronDownIcon
          className={cn(
            "size-3 shrink-0 opacity-50 transition-transform duration-200 motion-reduce:transition-none",
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
        <div className="text-foreground/60 bg-foreground/[0.03] max-h-64 overflow-y-auto rounded-md ps-7 pe-2 py-1.5 text-[13px] leading-relaxed whitespace-pre-wrap">
          {step.detail}
        </div>
      )}
    </>
  );
}

function StatChips({ stats }: { stats: TimelineStat[] }) {
  if (stats.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {stats.map((stat, index) => (
        <span
          key={`stat-${index}-${stat.file}`}
          className="bg-foreground/[0.06] text-foreground/70 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px]"
        >
          <span>{stat.file}</span>
          {stat.added !== undefined && (
            <span className="text-emerald-600 dark:text-emerald-400">
              +{stat.added}
            </span>
          )}
          {stat.removed !== undefined && (
            <span className="text-red-600 dark:text-red-400">−{stat.removed}</span>
          )}
        </span>
      ))}
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
    return (
      <div data-slot="tool-timeline" className={cn("w-full max-w-sm", className)}>
        <StepRow
          step={step}
          index={0}
          streaming={streaming}
          active={streaming}
          expanded={expandedSteps.has(0)}
          onToggle={() => toggleStep(0)}
        />
        <StatChips stats={stats} />
      </div>
    );
  }

  return (
    <Collapsible
      data-slot="tool-timeline"
      open={open}
      onOpenChange={onOpenChange}
      className={cn("w-full max-w-sm", className)}
    >
      <CollapsibleTrigger className="group/trigger text-foreground/55 hover:text-foreground/90 flex items-center gap-1.5 rounded-md py-1 text-[13.5px] transition-colors outline-none">
        <ChevronRightIcon className="size-3.5 shrink-0 opacity-60 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] group-data-open/trigger:rotate-90 group-data-panel-open/trigger:rotate-90 motion-reduce:transition-none" />
        <SwapLabel
          active={streaming ? 0 : 1}
          className="text-start tabular-nums"
        >
          <ShimmerLabel
            active={streaming}
            className="relative inline-block leading-none"
          >
            {activeLabel}
          </ShimmerLabel>
          <>{restingLabel}</>
        </SwapLabel>
        {streaming && elapsed !== undefined && (
          <span className={cn(mono, "text-foreground/30 tabular-nums")}>
            {elapsed}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className={cn(collapsePanel, "outline-none")}>
        <div className="flex flex-col gap-2.5 ps-4 pt-2.5">
          {steps.slice(0, Math.max(0, Math.min(visibleSteps, steps.length))).map((step, index, shown) => (
            <StepRow
              key={`step-${index}-${step.chip}`}
              step={step}
              index={index}
              streaming={streaming}
              active={streaming && index === shown.length - 1}
              expanded={expandedSteps.has(index)}
              onToggle={() => toggleStep(index)}
            />
          ))}
          <StatChips stats={stats} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
