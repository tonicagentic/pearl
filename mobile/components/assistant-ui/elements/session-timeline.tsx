import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import { Platform } from "react-native";
import Animated from "react-native-reanimated";
import { useAuiState } from "@assistant-ui/react-native";

import {
  hasOpenQuestion,
  isTimelineToolCall,
  type AssistantMessagePart,
} from "@/src/assistant-blocks";
import { useEveEvents } from "@/src/chat-context";
import { useWorkspaceOptional } from "@/src/workspace-context";
import { formatDurationMs, turnEventSpan } from "@/src/turn-duration";
import {
  composeActivityHeader,
  SETTLED_DURATION_MIN_MS,
  toActivityStep,
  type ActivityPart,
} from "../../../../lib/thread-activity";
import {
  createThinkingStateDweller,
  deriveLiveThinkingState,
} from "../../../../lib/stream-thinking-state";
import { useChatConversation } from "@/src/conversation-context";
import { TimelineDurationEventsContext } from "./timeline-duration-events";
import {
  ActivityPhrase,
  ToolTimeline,
  type TimelineStep,
} from "./tool-timeline";
import { stepEnter, useMotion } from "./surfaces";
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

function formatSettledDuration(ms: number): string | undefined {
  if (ms < SETTLED_DURATION_MIN_MS) return undefined;
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
  // Always start collapsed — the header shows the most recent live state.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
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
  const { conversation } = useChatConversation();
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

  const steps = toTimelineSteps(toolCalls, showLive);
  const header = useMemo(
    () => composeActivityHeader(toolCalls, { live: showLive }),
    [toolCalls, showLive],
  );
  // While the panel is open the last StepRow owns the live line. Header
  // summarizes only finished steps so "Searching…" is not printed twice.
  const openHeader = useMemo(() => {
    if (!showLive || toolCalls.length === 0) return header;
    const prior = toolCalls.slice(0, -1);
    if (prior.length === 0) {
      return {
        bits: [{ verb: "Working…", detail: "" }],
        text: "Working…",
        added: header.added,
        removed: header.removed,
      };
    }
    return composeActivityHeader(prior, { live: false });
  }, [header, showLive, toolCalls]);
  const derivedLiveHeader = useMemo(() => {
    if (!showLive) return header.text;
    const liveState = deriveLiveThinkingState({
      events: events as unknown as Parameters<
        typeof deriveLiveThinkingState
      >[0]["events"],
      parts: toolCalls,
      agents: conversation.agents as unknown as Parameters<
        typeof deriveLiveThinkingState
      >[0]["agents"],
      statusType: streaming ? "running" : statusType,
      waitingLabel: header.text || "Thinking",
    });
    return liveState.label ?? header.text;
  }, [
    conversation.agents,
    events,
    header.text,
    showLive,
    statusType,
    streaming,
    toolCalls,
  ]);

  const dwellerRef = useRef(createThinkingStateDweller());
  const [activeLabel, setActiveLabel] = useState(derivedLiveHeader);

  useEffect(() => {
    if (!showLive) {
      setActiveLabel(header.text);
      return undefined;
    }
    setActiveLabel(dwellerRef.current.next(derivedLiveHeader) ?? header.text);
    const timer = setInterval(() => {
      setActiveLabel(dwellerRef.current.flush() ?? header.text);
    }, 100);
    return () => clearInterval(timer);
  }, [derivedLiveHeader, header.text, showLive]);

  const motion = useMotion();
  const nativeMotion = motion && Platform.OS !== "web";
  const workspace = useWorkspaceOptional();

  if (steps.length === 0) return null;

  // Settled duration only — no live Ns ticks while streaming.
  const duration =
    isLast && !showLive ? settledDuration : undefined;

  return (
    <Animated.View entering={nativeMotion ? stepEnter : undefined}>
      <ToolTimeline
        steps={steps}
        visibleSteps={steps.length}
        streaming={showLive}
        open={userOpen ?? false}
        onOpenChange={setUserOpen}
        restingLabel={
          <ActivityPhrase
            bits={[...(showLive ? openHeader.bits : header.bits)]}
            emphasis={duration ? "detail" : "call"}
          />
        }
        activeLabel={activeLabel}
        headerAdded={header.added}
        headerRemoved={header.removed}
        elapsed={duration}
        onOpenFile={
          workspace
            ? (path) => {
                void workspace.openPath(path);
              }
            : undefined
        }
      />
    </Animated.View>
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
