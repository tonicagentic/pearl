import { Fragment, useEffect, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react-native";
import { Platform, Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  COLLAPSE_MS,
  CollapsePanel,
  ShimmerLabel,
  ThinkingStatesLabel,
  collapseEase,
  layoutTransition,
  stepEnter,
  thinkSwapEnter,
  threadDiffAdd,
  threadDiffRemove,
  threadMetaCall,
  threadMetaDetail,
  useMotion,
} from "./surfaces";

// RN port of the web tool-timeline: quiet meta rows, activity header,
// and inline edit diffs on the edit row — no Editing footer.

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
  added?: number;
  removed?: number;
}

export type ActivityBit = {
  readonly verb: string;
  readonly detail: string;
};

export interface ToolTimelineProps {
  readonly steps: readonly TimelineStep[];
  readonly visibleSteps: number;
  readonly streaming: boolean;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Settled header — prefer structured bits for verb/detail color split. */
  readonly restingLabel: ReactNode;
  /** Live header string (shimmer flattens children). */
  readonly activeLabel: string;
  readonly headerAdded?: number;
  readonly headerRemoved?: number;
  /** Elapsed badge: live while streaming, the settled duration after. */
  readonly elapsed?: string;
}

/** Verb in secondary muted; counts/paths in a lighter muted. */
export function ActivityPhrase({
  bits,
  prefix,
  numberOfLines = 2,
}: {
  readonly bits: readonly ActivityBit[];
  readonly prefix?: ReactNode;
  readonly numberOfLines?: number;
}) {
  if (bits.length === 0 && prefix == null) return null;
  return (
    <Text variant="label" numberOfLines={numberOfLines}>
      {prefix}
      {bits.map((bit, index) => (
        <Fragment key={`${bit.verb}-${index}`}>
          {index > 0 ? <Text className={threadMetaDetail}>, </Text> : null}
          <Text className={threadMetaCall}>{bit.verb}</Text>
          {bit.detail ? (
            <Text className={threadMetaDetail}>{` ${bit.detail}`}</Text>
          ) : null}
        </Fragment>
      ))}
    </Text>
  );
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

function DiffCounts({
  added,
  removed,
}: {
  readonly added?: number;
  readonly removed?: number;
}) {
  if (!added && !removed) return null;
  return (
    <View className="flex-row items-baseline gap-1.5">
      {added && added > 0 ? (
        <Text variant="label" className={cn(threadDiffAdd, "tabular-nums")}>
          +{added}
        </Text>
      ) : null}
      {removed && removed > 0 ? (
        <Text
          variant="label"
          className={cn(threadDiffRemove, "tabular-nums")}
        >
          −{removed}
        </Text>
      ) : null}
    </View>
  );
}

function isReasoningVerb(verb: string): boolean {
  return verb === "Thought" || verb === "Thinking…";
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
  const nativeMotion = motion && Platform.OS !== "web";
  const expandable = typeof step.detail === "string" && step.detail.length > 0;
  // Live reasoning reads "Thinking…" like Cursor; settled stays "Thought".
  const verb =
    active && step.verb === "Thought" ? "Thinking…" : step.verb;
  const showChip = step.chip.length > 0;

  return (
    <Animated.View
      entering={nativeMotion ? stepEnter : undefined}
      layout={nativeMotion ? layoutTransition : undefined}
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
        {active ? (
          <ThinkingStatesLabel
            label={verb}
            textClassName={cn(threadMetaCall, "shrink-0")}
          />
        ) : (
          <ShimmerLabel
            active={false}
            variant="label"
            className={cn(threadMetaCall, "shrink-0")}
          >
            {verb}
          </ShimmerLabel>
        )}
        {elapsed !== undefined ? (
          <Text
            variant="label"
            className={cn(threadMetaDetail, "tabular-nums")}
          >
            {elapsed}
          </Text>
        ) : null}
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
                variant="secondary"
                tone={step.failed ? "destructive" : "default"}
              >
                {step.chip}
              </Text>
            </View>
          ) : (
            <Text
              numberOfLines={1}
              variant="label"
              className={cn(threadMetaDetail, "min-w-0 flex-shrink")}
            >
              {step.chip}
            </Text>
          )
        ) : null}
        <DiffCounts added={step.added} removed={step.removed} />
        {expandable ? <MetaChevron open={expanded} /> : null}
      </Pressable>
      {expandable && expanded ? (
        <Animated.View
          entering={motion ? FadeIn.duration(DETAIL_MS) : undefined}
          exiting={motion ? FadeOut.duration(DETAIL_MS) : undefined}
          className="ms-0.5 mb-1 mt-0.5"
        >
          <Text selectable variant="body" className="opacity-90">
            {step.detail}
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
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
  headerAdded,
  headerRemoved,
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

  const rootEntering =
    motion && Platform.OS !== "web" ? thinkSwapEnter : undefined;

  // A single step needs no collapse chrome: render it inline.
  if (steps.length === 1) {
    const step = steps[0]!;
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
          elapsed={isReasoningVerb(step.verb) ? elapsed : undefined}
        />
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
        <View className="min-w-0 flex-1 flex-row flex-nowrap items-baseline gap-x-1.5">
          {streaming ? (
            // While expanded, the last StepRow owns the live label — keep the
            // header on the activity summary so the same "Searching…" line
            // does not appear twice.
            open ? (
              typeof restingLabel === "string" ? (
                <ShimmerLabel
                  active
                  variant="label"
                  className={threadMetaCall}
                  numberOfLines={1}
                >
                  {restingLabel}
                </ShimmerLabel>
              ) : (
                restingLabel
              )
            ) : (
              <ThinkingStatesLabel
                label={activeLabel}
                textClassName={threadMetaCall}
                className="min-w-0"
              />
            )
          ) : typeof restingLabel === "string" ? (
            <ThinkingStatesLabel
              label={restingLabel}
              shimmer={false}
              textClassName={threadMetaCall}
            />
          ) : (
            restingLabel
          )}
          {elapsed ? (
            <Text
              variant="label"
              className={cn(threadMetaDetail, "shrink-0 tabular-nums")}
            >
              {`· ${elapsed}`}
            </Text>
          ) : null}
          <DiffCounts added={headerAdded} removed={headerRemoved} />
        </View>
        <MetaChevron open={open} />
      </Pressable>
      <CollapsePanel open={open}>
        <Animated.View
          className="flex-col gap-0.5 pb-1 pt-1"
          layout={
            motion && Platform.OS !== "web" ? layoutTransition : undefined
          }
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
        </Animated.View>
      </CollapsePanel>
    </Animated.View>
  );
}
