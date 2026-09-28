import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { cn } from "@/lib/utils";
import { mono, ShimmerLabel, SwapLabel } from "./surfaces";

// RN port of the web tool-timeline element: a whole working turn summarized
// as one collapsed line — a verb and a chip per tool step, ending in
// file-change stats.

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
  filePath?: string;
}

export interface ToolTimelineProps {
  readonly steps: readonly TimelineStep[];
  readonly visibleSteps: number;
  readonly streaming: boolean;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly restingLabel: string;
  readonly activeLabel: string;
  readonly stats: readonly TimelineStat[];
  /** Elapsed badge: live while streaming, the settled duration after. */
  readonly elapsed?: string;
}

function StepRow({
  step,
  streaming,
  active,
  expanded,
  onToggle,
}: {
  readonly step: TimelineStep;
  readonly streaming: boolean;
  readonly active: boolean;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  const expandable = typeof step.detail === "string" && step.detail.length > 0;
  // Streaming steps read progressive ("Thinking"); settled ones past tense.
  const verb = active && step.verb === "Thought" ? "Thinking" : step.verb;

  return (
    <>
      <Pressable
        className="flex-row items-center gap-2"
        disabled={!expandable}
        onPress={onToggle}
        accessibilityState={{ expanded }}
      >
        <ShimmerLabel active={active} className="shrink-0 leading-none">
          {verb}
        </ShimmerLabel>
        <Text
          numberOfLines={1}
          className="min-w-0 flex-shrink rounded-md bg-foreground/[0.06] px-1.5 py-0.5 text-[11px] text-foreground/70"
        >
          {step.chip}
        </Text>
        {expandable ? (
          <ChevronDownIcon
            className={cn(
              "size-3 shrink-0 text-foreground/50 transition-transform",
              expanded && "rotate-180",
            )}
          />
        ) : null}
      </Pressable>
      {expandable && expanded ? (
        <View className="ms-7 rounded-md bg-foreground/[0.03] px-2 py-1.5 pe-2">
          <Text className="text-[13px] leading-relaxed text-foreground/60">
            {step.detail}
          </Text>
        </View>
      ) : null}
    </>
  );
}

function StatChips({ stats }: { readonly stats: readonly TimelineStat[] }) {
  if (stats.length === 0) return null;

  return (
    <View className="flex-row flex-wrap gap-1.5 pt-1">
      {stats.map((stat, index) => (
        <View
          key={`stat-${index}`}
          className="inline-flex flex-row items-center gap-1 rounded-md bg-foreground/[0.06] px-1.5 py-0.5"
        >
          <Text className="text-[11px] text-foreground/70">{stat.file}</Text>
          {stat.added !== undefined ? (
            <Text className="text-[11px] text-emerald-600">+{stat.added}</Text>
          ) : null}
          {stat.removed !== undefined ? (
            <Text className="text-[11px] text-red-600">−{stat.removed}</Text>
          ) : null}
        </View>
      ))}
    </View>
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

  const shown = steps.slice(0, Math.max(0, Math.min(visibleSteps, steps.length)));

  // A single step needs no collapse chrome: render it inline.
  if (steps.length === 1) {
    const step = steps[0];

    return (
      <View data-slot="tool-timeline" className="w-full">
        <StepRow
          step={step}
          streaming={streaming}
          active={streaming}
          expanded={expandedSteps.has(0)}
          onToggle={() => toggleStep(0)}
        />
        <StatChips stats={stats} />
      </View>
    );
  }

  return (
    <View data-slot="tool-timeline" className="w-full">
      <Pressable
        className="flex-row items-center gap-1.5 rounded-md py-1"
        accessibilityState={{ expanded: open }}
        onPress={() => onOpenChange(!open)}
      >
        <ChevronRightIcon
          className={cn(
            "size-3.5 shrink-0 text-foreground/60 transition-transform",
            open && "rotate-90",
          )}
        />
        <SwapLabel active={streaming ? 0 : 1} className="text-start">
          <ShimmerLabel active={streaming} className="leading-none">
            {activeLabel}
          </ShimmerLabel>
          <Text className="text-[13.5px] text-foreground/55">{restingLabel}</Text>
        </SwapLabel>
        {elapsed !== undefined ? (
          <Text className={cn(mono, "text-foreground/30")}>{elapsed}</Text>
        ) : null}
      </Pressable>
      {open ? (
        <View className="flex-col gap-2.5 pb-1 pl-4 pt-2.5">
          {shown.map((step, index) => (
            <StepRow
              key={`step-${index}-${step.chip}`}
              step={step}
              streaming={streaming}
              active={streaming && index === shown.length - 1}
              expanded={expandedSteps.has(index)}
              onToggle={() => toggleStep(index)}
            />
          ))}
          <StatChips stats={stats} />
        </View>
      ) : null}
    </View>
  );
}
