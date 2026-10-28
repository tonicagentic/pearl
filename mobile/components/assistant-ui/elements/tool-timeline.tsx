import { useState } from "react";
import { ChevronDownIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
} from "react-native-reanimated";

import { cn } from "@/lib/utils";
import {
  ShimmerLabel,
  SwapLabel,
  THINK_SWAP_MS,
  threadDiffAdd,
  threadDiffRemove,
  threadMeta,
  threadText,
  useMotion,
} from "./surfaces";

// RN port of the web tool-timeline: quiet meta rows, Worked-for header,
// and inline edit stats — no mono chips.

const STEP_ENTER_MS = 220;
const STEP_ENTER_Y = 6;
const DETAIL_MS = 180;

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
  active,
  expanded,
  onToggle,
  elapsed,
}: {
  readonly step: TimelineStep;
  readonly active: boolean;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  /** Shown beside Thought/Thinking on single-step turns. */
  readonly elapsed?: string;
}) {
  const motion = useMotion();
  const expandable = typeof step.detail === "string" && step.detail.length > 0;
  // Streaming steps read progressive ("Thinking"); settled ones past tense.
  const verb = active && step.verb === "Thought" ? "Thinking" : step.verb;
  const showChip = step.chip.length > 0;

  return (
    <Animated.View
      entering={
        motion
          ? FadeInDown.duration(STEP_ENTER_MS).withInitialValues({
              opacity: 0,
              transform: [{ translateY: STEP_ENTER_Y }],
            })
          : undefined
      }
    >
      <Pressable
        className={cn(
          "min-h-6 flex-row items-center gap-1.5 py-0.5",
          expandable && "active:opacity-70",
        )}
        disabled={!expandable}
        onPress={onToggle}
        accessibilityState={{ expanded }}
        hitSlop={
          expandable ? { top: 6, bottom: 6, left: 4, right: 4 } : undefined
        }
      >
        <ShimmerLabel
          active={active}
          className={cn(threadMeta, "shrink-0 leading-none")}
        >
          {verb}
        </ShimmerLabel>
        {elapsed !== undefined ? (
          <Text className={cn(threadMeta, "tabular-nums opacity-80")}>
            {elapsed}
          </Text>
        ) : null}
        {showChip ? (
          <Text numberOfLines={1} className={cn(threadMeta, "min-w-0 flex-shrink")}>
            {step.chip}
          </Text>
        ) : null}
        {expandable ? (
          <ChevronDownIcon
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground/50 transition-transform",
              expanded && "rotate-180",
            )}
          />
        ) : null}
      </Pressable>
      {expandable && expanded ? (
        <Animated.View
          entering={motion ? FadeIn.duration(DETAIL_MS) : undefined}
          exiting={motion ? FadeOut.duration(DETAIL_MS) : undefined}
          className="ms-0.5 mt-1"
        >
          <Text selectable className={cn(threadMeta, "leading-6")}>
            {step.detail}
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function StatLine({ stats }: { readonly stats: readonly TimelineStat[] }) {
  if (stats.length === 0) return null;

  const totalAdded = stats.reduce((sum, stat) => sum + (stat.added ?? 0), 0);
  const totalRemoved = stats.reduce(
    (sum, stat) => sum + (stat.removed ?? 0),
    0,
  );
  const files = stats.length;
  const summary = `Edited ${files} file${files === 1 ? "" : "s"}`;

  return (
    <View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5 py-0.5">
      <Text className={threadMeta}>{summary}</Text>
      {totalAdded > 0 || totalRemoved > 0 ? (
        <View className="flex-row items-center gap-1.5">
          {totalAdded > 0 ? (
            <Text className={cn(threadText, threadDiffAdd, "tabular-nums")}>
              +{totalAdded}
            </Text>
          ) : null}
          {totalRemoved > 0 ? (
            <Text className={cn(threadText, threadDiffRemove, "tabular-nums")}>
              -{totalRemoved}
            </Text>
          ) : null}
        </View>
      ) : null}
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
  const motion = useMotion();
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

  const shown = steps.slice(
    0,
    Math.max(0, Math.min(visibleSteps, steps.length)),
  );

  const rootEntering = motion
    ? FadeInDown.duration(THINK_SWAP_MS).withInitialValues({
        opacity: 0,
        transform: [{ translateY: STEP_ENTER_Y }],
      })
    : undefined;

  // A single step needs no collapse chrome: render it inline.
  if (steps.length === 1) {
    const step = steps[0];
    const stepElapsed = step.verb === "Thought" ? elapsed : undefined;

    return (
      <Animated.View
        entering={rootEntering}
        data-slot="tool-timeline"
        className="w-full"
      >
        <StepRow
          step={step}
          active={streaming}
          expanded={expandedSteps.has(0)}
          onToggle={() => toggleStep(0)}
          elapsed={stepElapsed}
        />
        <StatLine stats={stats} />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={rootEntering}
      data-slot="tool-timeline"
      className="w-full"
    >
      <Pressable
        className="flex-row items-center gap-1 rounded-md py-0.5"
        accessibilityState={{ expanded: open }}
        onPress={() => onOpenChange(!open)}
      >
        <SwapLabel active={streaming ? 0 : 1} className="text-start">
          <ShimmerLabel active={streaming} className={cn(threadMeta, "leading-none")}>
            {elapsed ? `${activeLabel} ${elapsed}` : activeLabel}
          </ShimmerLabel>
          <Text className={threadMeta}>{restingLabel}</Text>
        </SwapLabel>
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground/50 transition-transform",
            open && "rotate-180",
          )}
        />
      </Pressable>
      {open ? (
        <View className="flex-col gap-1 pb-1 pt-1.5">
          {shown.map((step, index) => (
            <StepRow
              key={`step-${index}-${step.verb}-${step.chip}`}
              step={step}
              active={streaming && index === shown.length - 1}
              expanded={expandedSteps.has(index)}
              onToggle={() => toggleStep(index)}
            />
          ))}
          <StatLine stats={stats} />
        </View>
      ) : null}
    </Animated.View>
  );
}
