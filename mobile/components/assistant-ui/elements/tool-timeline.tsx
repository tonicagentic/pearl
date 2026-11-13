import { useEffect, useState } from "react";
import { ChevronDownIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  COLLAPSE_MS,
  CollapsePanel,
  ShimmerLabel,
  SwapLabel,
  collapseEase,
  layoutTransition,
  stepEnter,
  thinkSwapEnter,
  threadDiffAdd,
  threadDiffRemove,
  threadMeta,
  threadText,
  useMotion,
} from "./surfaces";

// RN port of the web tool-timeline: quiet meta rows, Worked-for header,
// and inline edit stats — no mono chips.

const DETAIL_MS = 180;

export interface TimelineStep {
  verb: string;
  chip: string;
  /** Optional body shown when the step is expanded (e.g. reasoning text). */
  detail?: string;
  /** The file this step touched; set when the chip opens the canvas. */
  filePath?: string;
  /** Distinct presentation for load_skill rows. */
  kind?: "skill";
  failed?: boolean;
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

/** ChevronDown points right when collapsed, down when open. */
function MetaChevron({ open }: { readonly open: boolean }) {
  const motion = useMotion();
  const rotation = useSharedValue(open ? 0 : -90);

  useEffect(() => {
    if (!motion) {
      rotation.value = open ? 0 : -90;
      return;
    }
    rotation.value = withTiming(open ? 0 : -90, {
      duration: COLLAPSE_MS,
      easing: collapseEase,
    });
  }, [open, motion, rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View className="size-3.5 items-center justify-center" style={style}>
      <Icon
        as={ChevronDownIcon}
        className="size-3.5 text-muted-foreground/55"
      />
    </Animated.View>
  );
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
  // Live reasoning reads "Thinking…" like Cursor; settled stays "Thought".
  const verb =
    active && step.verb === "Thought" ? "Thinking…" : step.verb;
  const showChip = step.chip.length > 0;
  // One text node keeps verb + duration on the same baseline ("Thought 2s").
  const label =
    elapsed !== undefined ? `${verb.replace(/…$/, "")} ${elapsed}` : verb;

  return (
    <Animated.View
      entering={motion ? stepEnter : undefined}
      layout={motion ? layoutTransition : undefined}
    >
      <Pressable
        className={cn(
          "min-h-7 flex-row items-baseline gap-1.5 py-1.5",
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
          className={cn(threadMeta, "shrink-0 leading-6")}
        >
          {label}
        </ShimmerLabel>
        {showChip ? (
          step.kind === "skill" ? (
            <View
              className={cn(
                "max-w-[70%] rounded-full px-2.5 py-0.5",
                step.failed ? "bg-destructive/15" : "bg-muted/80",
              )}
            >
              <Text
                numberOfLines={1}
                className={cn(
                  "text-[13px] leading-5",
                  step.failed ? "text-destructive" : "text-foreground",
                )}
              >
                {step.chip}
              </Text>
            </View>
          ) : (
            <Text
              numberOfLines={1}
              className={cn(threadMeta, "min-w-0 flex-shrink leading-6")}
            >
              {step.chip}
            </Text>
          )
        ) : null}
        {expandable ? <MetaChevron open={expanded} /> : null}
      </Pressable>
      {expandable && expanded ? (
        <Animated.View
          entering={motion ? FadeIn.duration(DETAIL_MS) : undefined}
          exiting={motion ? FadeOut.duration(DETAIL_MS) : undefined}
          className="ms-0.5 mb-1 mt-0.5"
        >
          <Text selectable className={cn(threadText, "text-foreground/90 leading-6")}>
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
  const latest = stats[stats.length - 1];
  // Cursor: "Editing file.tsx … +10" — prefer the latest file when present.
  const summary =
    stats.length === 1 && latest
      ? `Editing ${latest.file}`
      : `Edited ${stats.length} file${stats.length === 1 ? "" : "s"}`;

  return (
    <View className="flex-row flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5">
      <Text className={cn(threadMeta, "leading-6")}>{summary}</Text>
      {totalAdded > 0 || totalRemoved > 0 ? (
        <View className="flex-row items-baseline gap-1.5">
          {totalAdded > 0 ? (
            <Text className={cn(threadText, threadDiffAdd, "tabular-nums leading-6")}>
              +{totalAdded}
            </Text>
          ) : null}
          {totalRemoved > 0 ? (
            <Text className={cn(threadText, threadDiffRemove, "tabular-nums leading-6")}>
              −{totalRemoved}
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

  const rootEntering = motion ? thinkSwapEnter : undefined;

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
        className="min-h-7 flex-row items-baseline gap-1.5 py-1.5"
        accessibilityState={{ expanded: open }}
        onPress={() => onOpenChange(!open)}
      >
        <SwapLabel active={streaming ? 0 : 1} className="min-w-0 flex-1 text-start">
          <ShimmerLabel
            active={streaming}
            className={cn(threadMeta, "leading-6")}
            numberOfLines={2}
          >
            {elapsed ? `${activeLabel} · ${elapsed}` : activeLabel}
          </ShimmerLabel>
          <Text className={cn(threadMeta, "leading-6")} numberOfLines={2}>
            {restingLabel}
          </Text>
        </SwapLabel>
        <MetaChevron open={open} />
      </Pressable>
      <CollapsePanel open={open}>
        <Animated.View
          className="flex-col gap-0.5 pb-1 pt-1"
          layout={motion ? layoutTransition : undefined}
        >
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
        </Animated.View>
      </CollapsePanel>
    </Animated.View>
  );
}
