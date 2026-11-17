"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuiState } from "@assistant-ui/react";
import { useEveEvents } from "@assistant-ui/eve";

import { useCanvas } from "@/components/assistant-ui/elements/canvas-context";
import { DELEGATION_TOOLS } from "@/components/assistant-ui/elements/task-card.aui";
import {
  composeActivityHeader,
  SETTLED_DURATION_MIN_MS,
  toActivityStep,
  type ActivityPart,
} from "@/lib/thread-activity";
import {
  createThinkingStateDweller,
  deriveLiveThinkingState,
} from "@/lib/stream-thinking-state";

import {
  ToolTimeline,
  type TimelineStep,
} from "@/components/assistant-ui/elements/tool-timeline";

// The runtime part state for a tool call or reasoning (shape per docs:
// elements/tool-timeline).
type TimelinePart = ActivityPart;

/** Tools that keep their own card instead of a timeline step. */
export function isStandaloneTool(toolName: string): boolean {
  return (
    toolName === "todo" ||
    toolName === "write_file" ||
    DELEGATION_TOOLS.has(toolName)
  );
}

/**
 * Whether a message part is summarized by the session timeline (and should
 * render nothing in the grouped parts body).
 */
export function isTimelineCoveredPart(part: {
  readonly type?: string;
  readonly toolName?: string;
  readonly status?: { readonly type?: string };
} | null | undefined): boolean {
  if (!part) return false;
  if (part.type === "reasoning") return true;
  if (part.type !== "tool-call") return false;
  if (part.status?.type === "requires-action") return false;
  if (!part.toolName) return false;
  if (part.toolName === "todo") return true;
  if (isStandaloneTool(part.toolName)) return false;
  return true;
}

/** Whether this tool call appears as a timeline step. */
export function isTimelineToolCall(part: {
  readonly type?: string;
  readonly toolName?: string;
  readonly status?: { readonly type?: string };
}): boolean {
  return (
    part.type === "tool-call" &&
    !!part.toolName &&
    !isStandaloneTool(part.toolName) &&
    part.status?.type !== "requires-action"
  );
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

// A whole working turn summarized as one collapsed line: a verb and a chip
// per tool step, with line diffs on edit rows and the header (docs:
// elements/tool-timeline). Rendered beside the message parts; the covered
// tool parts render null so nothing shows twice.
export function SessionTimeline() {
  const { openPath } = useCanvas();
  // Always start collapsed — the header shows the most recent live state.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const streaming = useAuiState((s) => s.message.status?.type === "running");
  const turnId = useAuiState(
    (s) =>
      (s.message.metadata as { turnId?: string } | undefined)?.turnId,
  );
  const toolCalls = (
    useAuiState((s) => s.message.parts) as readonly unknown[]
  ).filter((part): part is TimelinePart => {
    if (typeof part !== "object" || part === null) return false;
    const typed = part as {
      type?: string;
      toolName?: string;
      status?: { type?: string };
    };
    if (typed.type === "reasoning") return true;
    return isTimelineToolCall(typed);
  });

  // Durable turn duration, derived from the persisted event log: first to
  // last assistant-role event timestamp for this turn (each event carries
  // meta.at and data.turnId). Survives reloads — no wall clock at render.
  const events = useEveEvents();
  const settledDuration = useMemo(() => {
    if (streaming || !turnId) return undefined;
    let start: number | undefined;
    let end: number | undefined;
    for (const event of events) {
      const raw = event as {
        type?: string;
        data?: { turnId?: unknown };
        meta?: { at?: unknown };
      };
      if (raw?.type === "message.received") continue; // user-side marker
      if (raw.data?.turnId !== turnId) continue;
      const at = raw.meta?.at;
      const ts = typeof at === "string" ? Date.parse(at) : NaN;
      if (!Number.isFinite(ts)) continue;
      start ??= ts;
      end = ts;
    }
    if (start === undefined || end === undefined) return undefined;
    const ms = end - start;
    if (ms < SETTLED_DURATION_MIN_MS) return undefined;
    return formatDuration(ms);
  }, [events, streaming, turnId]);

  const steps = toTimelineSteps(toolCalls, streaming);
  const header = useMemo(
    () => composeActivityHeader(toolCalls, { live: streaming }),
    [toolCalls, streaming],
  );
  // Expanded header drops the live trailing step so StepRow owns that line.
  const openHeaderText = useMemo(() => {
    if (!streaming || toolCalls.length === 0) return header.text;
    const prior = toolCalls.slice(0, -1);
    if (prior.length === 0) return "Working…";
    return composeActivityHeader(prior, { live: false }).text;
  }, [header.text, streaming, toolCalls]);
  const derivedLiveHeader = useMemo(() => {
    if (!streaming) return header.text;
    const live = deriveLiveThinkingState({
      events: events as unknown as Parameters<
        typeof deriveLiveThinkingState
      >[0]["events"],
      parts: toolCalls,
      statusType: "running",
      waitingLabel: header.text || "Thinking",
    });
    return live.label ?? header.text;
  }, [events, header.text, streaming, toolCalls]);

  const dwellerRef = useRef(createThinkingStateDweller());
  const [activeLabel, setActiveLabel] = useState(derivedLiveHeader);

  useEffect(() => {
    if (!streaming) {
      setActiveLabel(header.text);
      return undefined;
    }
    setActiveLabel(dwellerRef.current.next(derivedLiveHeader) ?? header.text);
    const timer = window.setInterval(() => {
      setActiveLabel(dwellerRef.current.flush() ?? header.text);
    }, 100);
    return () => window.clearInterval(timer);
  }, [derivedLiveHeader, header.text, streaming]);

  if (steps.length === 0) return null;

  return (
    <ToolTimeline
      steps={steps}
      visibleSteps={steps.length}
      streaming={streaming}
      open={userOpen ?? false}
      onOpenChange={setUserOpen}
      restingLabel={streaming ? openHeaderText : header.text}
      activeLabel={activeLabel}
      headerAdded={header.added}
      headerRemoved={header.removed}
      elapsed={streaming ? undefined : settledDuration}
      onOpenFile={openPath}
    />
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return `${minutes}m ${rest}s`;
  const hours = Math.floor(minutes / 60);
  return `${Math.round(hours)}h ${minutes % 60}m`;
}
