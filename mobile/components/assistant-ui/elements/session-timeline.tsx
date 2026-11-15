import { useContext, useMemo, useState, type FC } from "react";
import { useAuiState } from "@assistant-ui/react-native";

import {
  hasOpenQuestion,
  isTimelineToolCall,
  type AssistantMessagePart,
} from "@/src/assistant-blocks";
import { useEveEvents } from "@/src/chat-context";
import { formatDurationMs, turnEventSpan } from "@/src/turn-duration";
import {
  composeActivityHeader,
  toActivityStep,
  type ActivityPart,
} from "../../../../lib/thread-activity";
import { TimelineDurationEventsContext } from "./timeline-duration-events";
import {
  ActivityPhrase,
  ToolTimeline,
  type TimelineStep,
} from "./tool-timeline";
import { useTurnElapsed } from "./turn-elapsed";

export {
  TimelineDurationEventsContext,
  TimelineDurationEventsProvider,
} from "./timeline-duration-events";

export {
  hasComposerOpenQuestion,
  hasOpenQuestion,
  isContentBlockPart,
  isStandaloneTool,
  isTimelineCoveredPart,
  isTimelineToolCall,
  isTrailingContentPhase,
  lastTimelineBlockIndex,
  splitAssistantBlocks,
  type AssistantBlock,
  type AssistantContentBlock,
  type AssistantMessagePart,
  type AssistantTimelineBlock,
} from "@/src/assistant-blocks";

// Timeline steps are split at visible content boundaries so earlier tools
// stay above mid-turn text and live activity stays on the trailing segment.

type TimelinePart = ActivityPart;

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return `${minutes}m ${rest}s`;
  const hours = Math.floor(minutes / 60);
  return `${Math.round(hours)}h ${minutes % 60}m`;
}

function formatSettledDuration(ms: number): string {
  if (ms < 60_000) return formatDurationMs(ms);
  return formatDuration(ms);
}

function asTimelineParts(
  messageParts: readonly unknown[],
  indices: readonly number[],
): TimelinePart[] {
  const out: TimelinePart[] = [];
  for (const index of indices) {
    const part = messageParts[index];
    if (typeof part !== "object" || part === null) continue;
    const typed = part as AssistantMessagePart & TimelinePart;
    if (typed.type === "reasoning" || isTimelineToolCall(typed)) {
      out.push(typed as TimelinePart);
    }
  }
  return out;
}

function toTimelineSteps(
  parts: readonly TimelinePart[],
  live: boolean,
): TimelineStep[] {
  return parts.map((part, index) => {
    const stepLive = live && index === parts.length - 1;
    const step = toActivityStep(part, { live: stepLive });
    return {
      verb: step.verb,
      chip: step.chip,
      detail: step.detail,
      filePath: step.filePath,
      added: step.added,
      removed: step.removed,
      kind: step.kind,
      failed: step.failed,
    };
  });
}

/**
 * One timeline segment for a contiguous slice of reasoning/tool parts.
 * Only the last segment may shimmer live activity or show the turn duration.
 */
export const SessionTimelineSegment: FC<{
  readonly indices: readonly number[];
  /** Last timeline segment in the turn (owns settled duration). */
  readonly isLast: boolean;
  /**
   * Trailing work cluster — only this segment may shimmer live activity.
   * Defaults to `isLast` for the deprecated whole-turn SessionTimeline.
   */
  readonly live?: boolean;
}> = ({ indices, isLast, live = isLast }) => {
  const overrideEvents = useContext(TimelineDurationEventsContext);
  const [userOpen, setUserOpen] = useState<boolean | null>(
    () => (overrideEvents != null ? true : null),
  );
  const statusType = useAuiState((s) => s.message.status?.type);
  const streaming = statusType === "running";
  const awaitingInput = statusType === "requires-action";
  const turnId = useAuiState(
    (s) => s.message.metadata?.custom?.turnId as string | undefined,
  );
  const messageParts = useAuiState((s) => s.message.parts) as readonly unknown[];
  const askingQuestions = useAuiState((s) =>
    hasOpenQuestion(s.message.parts as readonly AssistantMessagePart[]),
  );
  const toolCalls = useMemo(
    () => asTimelineParts(messageParts, indices),
    [messageParts, indices],
  );

  const liveEvents = useEveEvents();
  const events = overrideEvents ?? liveEvents;
  // Questions own the status line ("Asking questions"); fold the timeline.
  // Approvals / sign-in keep the live shimmer until the user answers.
  const showLive =
    live && (streaming || (awaitingInput && !askingQuestions));
  // Event-log span once the turn settles; while the answer is still printing
  // we reuse the frozen live clock from TurnElapsedProvider instead.
  const settledDuration = useMemo(() => {
    if (!isLast || showLive || awaitingInput || streaming || !turnId) {
      return undefined;
    }
    const span = turnEventSpan(events, turnId);
    if (!span) return undefined;
    return formatSettledDuration(span.endMs - span.startMs);
  }, [events, streaming, awaitingInput, turnId, isLast, showLive]);

  const liveElapsed = useTurnElapsed();
  const steps = toTimelineSteps(toolCalls, showLive);
  const header = useMemo(
    () => composeActivityHeader(toolCalls, { live: showLive }),
    [toolCalls, showLive],
  );

  if (steps.length === 0) return null;

  const workedFor =
    isLast && !showLive
      ? (settledDuration ?? (streaming ? liveElapsed : undefined))
      : undefined;
  const duration = showLive ? liveElapsed : workedFor;

  return (
    <ToolTimeline
      steps={steps}
      visibleSteps={steps.length}
      streaming={showLive}
      open={userOpen ?? showLive}
      onOpenChange={setUserOpen}
      restingLabel={<ActivityPhrase bits={[...header.bits]} />}
      activeLabel={header.text}
      headerAdded={header.added}
      headerRemoved={header.removed}
      elapsed={duration}
    />
  );
};

/** @deprecated Prefer interleaved SessionTimelineSegment blocks. */
export function SessionTimeline() {
  const messageParts = useAuiState(
    (s) => s.message.parts,
  ) as readonly AssistantMessagePart[];
  const indices = useMemo(() => {
    const out: number[] = [];
    messageParts.forEach((part, index) => {
      if (part.type === "reasoning" || isTimelineToolCall(part)) {
        out.push(index);
      }
    });
    return out;
  }, [messageParts]);
  if (indices.length === 0) return null;
  return <SessionTimelineSegment indices={indices} isLast />;
}
