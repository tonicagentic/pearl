import { Fragment, useEffect, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react-native";
import { SymbolView } from "expo-symbols";
import { Platform, Pressable, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { formatWorkedFor } from "../../../../lib/thread-activity";
import {
  CollapsePanel,
  ShimmerLabel,
  ThinkingStatesLabel,
  layoutTransition,
  stepEnter,
  thinkSwapEnter,
  threadDiffAdd,
  threadDiffRemove,
  threadMetaCall,
  threadMetaDetail,
  useMotion,
} from "./surfaces";

const CHEVRON_SIZE = 16;

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
  /** Open a file path from a timeline chip (mobile file canvas / Computer). */
  readonly onOpenFile?: (path: string) => void;
}

/** Verb in secondary muted; counts/paths in a lighter muted. */
export function ActivityPhrase({
  bits,
  prefix,
  numberOfLines = 2,
  /** When `detail`, the whole phrase sits under a leading call (e.g. Worked for). */
  emphasis = "call",
}: {
  readonly bits: readonly ActivityBit[];
  readonly prefix?: ReactNode;
  readonly numberOfLines?: number;
  readonly emphasis?: "call" | "detail";
}) {
  if (bits.length === 0 && prefix == null) return null;
  const verbClass = emphasis === "call" ? threadMetaCall : threadMetaDetail;
  return (
    <Text variant="body" numberOfLines={numberOfLines}>
      {prefix}
      {bits.map((bit, index) => (
        <Fragment key={`${bit.verb}-${index}`}>
          {index > 0 ? (
            <Text variant="body" className={threadMetaDetail}>
              {", "}
            </Text>
          ) : null}
          <Text variant="body" className={verbClass}>
            {bit.verb}
          </Text>
          {bit.detail ? (
            <Text variant="body" className={threadMetaDetail}>
              {` ${bit.detail}`}
            </Text>
          ) : null}
        </Fragment>
      ))}
    </Text>
  );
}

/** Native disclosure chevron — points right when collapsed, down when open. */
function MetaChevron({ open }: { readonly open: boolean }) {
  const motion = useMotion();
  const rotation = useSharedValue(open ? 0 : -90);
  const scale = useSharedValue(1);
  const tint =
    (useCSSVariable("--color-muted-foreground") as string | undefined) ??
    "#8a8a8a";

  useEffect(() => {
    if (!motion) {
      rotation.value = open ? 0 : -90;
      scale.value = 1;
      return;
    }
    rotation.value = withSpring(open ? 0 : -90, {
      damping: 18,
      stiffness: 220,
      mass: 0.6,
    });
    scale.value = withTiming(
      0.86,
      {
        duration: 90,
        easing: Easing.out(Easing.quad),
      },
      (finished) => {
        if (finished) {
          scale.value = withSpring(1, { damping: 14, stiffness: 280 });
        }
      },
    );
  }, [open, motion, rotation, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  const nativeMotion = motion && Platform.OS !== "web";

  return (
    <Animated.View
      entering={nativeMotion ? FadeIn.duration(160) : undefined}
      className="items-center justify-center"
      style={[{ width: CHEVRON_SIZE, height: CHEVRON_SIZE }, style]}
    >
      <SymbolView
        name={{
          ios: "chevron.down",
          android: "expand_more",
          web: "expand_more",
        }}
        size={CHEVRON_SIZE}
        weight="medium"
        tintColor={tint}
        fallback={
          <Icon
            as={ChevronDownIcon}
            size={CHEVRON_SIZE}
            className="text-muted-foreground/55"
          />
        }
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
        <Text variant="body" className={cn(threadDiffAdd, "tabular-nums")}>
          +{added}
        </Text>
      ) : null}
      {removed && removed > 0 ? (
        <Text
          variant="body"
          className={cn(threadDiffRemove, "tabular-nums")}
        >
          −{removed}
        </Text>
      ) : null}
    </View>
  );
}

function isReasoningVerb(verb: string): boolean {
  return verb === "Thought" || verb === "Thinking…" || verb === "Thinking";
}

function StepRow({
  step,
  active,
  expanded,
  onToggle,
  elapsed,
  onOpenFile,
}: {
  readonly step: TimelineStep;
  readonly active: boolean;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  /** Shown beside Thought/Thinking on single-step turns. */
  readonly elapsed?: string;
  readonly onOpenFile?: (path: string) => void;
}) {
  const motion = useMotion();
  const nativeMotion = motion && Platform.OS !== "web";
  const expandable = typeof step.detail === "string" && step.detail.length > 0;
  // Live reasoning reads "Thinking"; settled stays "Thought".
  const verb =
    active && step.verb === "Thought" ? "Thinking" : step.verb;
  const showChip = step.chip.length > 0;
  const fileOpenable = Boolean(step.filePath && onOpenFile);

  return (
    <Animated.View
      entering={nativeMotion ? stepEnter : undefined}
      layout={nativeMotion ? layoutTransition : undefined}
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
          expandable ? { top: 8, bottom: 8, left: 4, right: 4 } : undefined
        }
      >
        {elapsed !== undefined ? (
          <Text
            variant="body"
            className={cn(threadMetaCall, "shrink-0 tabular-nums")}
          >
            {formatWorkedFor(elapsed)}
          </Text>
        ) : null}
        {active ? (
          <ThinkingStatesLabel
            label={verb}
            textClassName={cn(
              elapsed !== undefined ? threadMetaDetail : threadMetaCall,
              "shrink-0",
            )}
          />
        ) : (
          <ShimmerLabel
            active={false}
            variant="body"
            className={cn(
              elapsed !== undefined ? threadMetaDetail : threadMetaCall,
              "shrink-0",
            )}
          >
            {verb}
          </ShimmerLabel>
        )}
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
          ) : fileOpenable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${step.filePath}`}
              hitSlop={6}
              onPress={(event) => {
                event.stopPropagation?.();
                onOpenFile?.(step.filePath!);
              }}
            >
              <Text
                numberOfLines={1}
                variant="body"
                tone="primary"
                className="min-w-0 flex-shrink"
              >
                {step.chip}
              </Text>
            </Pressable>
          ) : (
            <Text
              numberOfLines={1}
              variant="body"
              className={cn(threadMetaDetail, "min-w-0 flex-shrink")}
            >
              {step.chip}
            </Text>
          )
        ) : null}
        <DiffCounts added={step.added} removed={step.removed} />
        {expandable && expanded ? <MetaChevron open /> : null}
      </Pressable>
      {expandable && expanded ? (
        <Animated.View
          entering={motion ? FadeIn.duration(DETAIL_MS) : undefined}
          exiting={motion ? FadeOut.duration(DETAIL_MS) : undefined}
          className="ms-0.5 mb-1 mt-0.5"
        >
          <Text selectable variant="label" className="opacity-90">
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
  onOpenFile,
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
          onOpenFile={onOpenFile}
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
        className="min-h-6 flex-row items-center gap-1.5 py-0.5"
        accessibilityState={{ expanded: open }}
        onPress={() => onOpenChange(!open)}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <View className="min-w-0 flex-row flex-nowrap items-center gap-x-1.5">
          {elapsed ? (
            <Text
              variant="body"
              className={cn(threadMetaCall, "shrink-0 tabular-nums")}
            >
              {formatWorkedFor(elapsed)}
            </Text>
          ) : null}
          {streaming ? (
            // While expanded, the last StepRow owns the live label — keep the
            // header on the activity summary so the same "Searching…" line
            // does not appear twice.
            open ? (
              typeof restingLabel === "string" ? (
                <ShimmerLabel
                  active
                  variant="body"
                  className={elapsed ? threadMetaDetail : threadMetaCall}
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
                textClassName={elapsed ? threadMetaDetail : threadMetaCall}
                className="min-w-0"
              />
            )
          ) : typeof restingLabel === "string" ? (
            <ThinkingStatesLabel
              label={restingLabel}
              shimmer={false}
              textClassName={elapsed ? threadMetaDetail : threadMetaCall}
            />
          ) : (
            restingLabel
          )}
          <DiffCounts added={headerAdded} removed={headerRemoved} />
          {open ? <MetaChevron open /> : null}
        </View>
      </Pressable>
      <CollapsePanel open={open}>
        <Animated.View
          className="flex-col gap-0.5 pb-1 ps-3 pt-1"
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
              onOpenFile={onOpenFile}
            />
          ))}
        </Animated.View>
      </CollapsePanel>
    </Animated.View>
  );
}
