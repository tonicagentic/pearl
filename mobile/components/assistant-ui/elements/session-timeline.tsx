import { useContext, useMemo, useState, type FC } from "react";
import { useAuiState } from "@assistant-ui/react-native";

import {
  isTimelineToolCall,
  type AssistantMessagePart,
} from "@/src/assistant-blocks";
import { useEveEvents } from "@/src/chat-context";
import { formatDurationMs, turnEventSpan } from "@/src/turn-duration";
import { getToolPresentation } from "./tool-presentation";
import { TimelineDurationEventsContext } from "./timeline-duration-events";
import {
  ToolTimeline,
  type TimelineStat,
  type TimelineStep,
} from "./tool-timeline";
import { useTurnElapsed } from "./turn-elapsed";

export {
  TimelineDurationEventsContext,
  TimelineDurationEventsProvider,
} from "./timeline-duration-events";

export {
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
// stay above mid-turn text and live Working stays on the trailing segment.

type ToolCallState = {
  readonly type: "tool-call";
  readonly toolName: string;
  readonly args?: unknown;
  readonly result?: unknown;
  readonly toolCallId?: string;
  readonly status?: { readonly type?: string };
};

type ReasoningState = {
  readonly type: "reasoning";
  readonly text?: string;
};

type TimelinePart = ToolCallState | ReasoningState;

const TOOL_META: Record<string, { verb: string }> = {
  edit_file: { verb: "Edited" },
  read_file: { verb: "Read" },
  web_search: { verb: "Searched" },
  web_fetch: { verb: "Opened" },
  browser: { verb: "Browsed" },
  exa_agent_run: { verb: "Researched" },
  file__save_memory: { verb: "Remembered" },
  file__remove_memory: { verb: "Forgot" },
  load_skill: { verb: "Loaded" },
  get_weather: { verb: "Checked" },
  get_profile: { verb: "Loaded profile" },
  bash: { verb: "Ran" },
  glob: { verb: "Listed" },
  grep: { verb: "Searched" },
  task_cancel: { verb: "Cancelled" },
  send_notification: { verb: "Notified" },
  read_attachment: { verb: "Read attachment" },
  deploy_vercel: { verb: "Deployed" },
  merge_pr: { verb: "Merged" },
  eas_build: { verb: "Started EAS build" },
  eas_submit: { verb: "Submitted to EAS" },
  run_with_env: { verb: "Ran with env" },
  preview_check: { verb: "Checked preview" },
  deployment_logs: { verb: "Opened logs" },
};

function basename(path: string): string {
  return path.split("/").pop() || path;
}

function siteChip(raw: string): string {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    if (!path) return host;
    const clipped =
      path.length > 48 ? `${path.slice(0, 45).replace(/\/?$/, "")}…` : path;
    return `${host}${clipped}`;
  } catch {
    return "";
  }
}

function chipFor(part: ToolCallState): string {
  const args = (part.args ?? {}) as Record<string, unknown>;
  if (typeof args.filePath === "string") return basename(args.filePath);
  if (typeof args.command === "string") return args.command;
  if (typeof args.pattern === "string") return args.pattern;
  if (typeof args.query === "string") return args.query;
  if (typeof args.skill === "string") return args.skill;
  if (typeof args.recipient === "string") return args.recipient;
  if (typeof args.attachmentId === "string") return args.attachmentId;
  if (typeof args.taskId === "string") return args.taskId;
  if (typeof args.url === "string") {
    const site = siteChip(args.url);
    if (site) return site;
  }
  if (typeof args.message === "string") {
    return args.message.split("\n")[0].slice(0, 200);
  }
  if (typeof args.title === "string") return args.title;
  if (typeof args.name === "string") return args.name;
  return getToolPresentation(part.toolName).label;
}

function toStep(part: TimelinePart): TimelineStep {
  const args = (part.type === "tool-call" ? (part.args ?? {}) : {}) as {
    filePath?: unknown;
    skill?: unknown;
  };
  const filePath =
    typeof args.filePath === "string" ? args.filePath : undefined;
  if (part.type === "reasoning") {
    return {
      verb: "Thought",
      chip: "",
      detail: part.text,
      filePath,
    };
  }
  const meta = TOOL_META[part.toolName];
  if (part.toolName === "load_skill") {
    const skillName =
      typeof args.skill === "string" && args.skill.trim()
        ? args.skill.trim()
        : chipFor(part);
    const failed =
      part.result !== undefined &&
      typeof part.result === "object" &&
      part.result !== null &&
      "error" in (part.result as object);
    return {
      verb: failed ? "Skill failed" : "Skill",
      chip: skillName.slice(0, 200),
      detail: failed
        ? String((part.result as { error?: unknown }).error ?? "Could not load skill")
        : `Loaded ${skillName}`,
      filePath,
      kind: "skill",
      failed,
    };
  }
  return {
    verb: meta?.verb ?? getToolPresentation(part.toolName).label,
    chip: chipFor(part).slice(0, 200),
    filePath,
  };
}

function lineCount(text: string | undefined): number | undefined {
  if (text === undefined) return undefined;
  if (text.length === 0) return 0;
  return text.split("\n").length;
}

function toStats(parts: readonly TimelinePart[]): TimelineStat[] {
  return parts
    .filter(
      (part): part is ToolCallState =>
        part.type === "tool-call" && part.toolName === "edit_file",
    )
    .map((part) => {
      const args = (part.args ?? {}) as {
        filePath?: string;
        oldText?: string;
        newText?: string;
      };
      return {
        file: basename(args.filePath ?? "file"),
        added: lineCount(args.newText),
        removed: lineCount(args.oldText),
        filePath: args.filePath,
      };
    });
}

/** Cursor-style activity summaries: "Explored 2 files, ran 1 command." */
function summarizeActivity(parts: readonly TimelinePart[]): {
  readonly explored: number;
  readonly ran: number;
  readonly searched: number;
  readonly edited: number;
  readonly lastEditFile?: string;
} {
  let explored = 0;
  let ran = 0;
  let searched = 0;
  let edited = 0;
  let lastEditFile: string | undefined;
  for (const part of parts) {
    if (part.type !== "tool-call") continue;
    switch (part.toolName) {
      case "read_file":
      case "glob":
      case "read_attachment":
        explored += 1;
        break;
      case "bash":
      case "run_with_env":
        ran += 1;
        break;
      case "grep":
      case "web_search":
      case "exa_agent_run":
        searched += 1;
        break;
      case "edit_file": {
        edited += 1;
        const path = (part.args as { filePath?: unknown } | undefined)?.filePath;
        if (typeof path === "string") lastEditFile = basename(path);
        break;
      }
      default:
        break;
    }
  }
  return { explored, ran, searched, edited, lastEditFile };
}

function formatActivitySummary(summary: ReturnType<typeof summarizeActivity>): string {
  const bits: string[] = [];
  if (summary.explored > 0) {
    bits.push(
      `Explored ${summary.explored} file${summary.explored === 1 ? "" : "s"}`,
    );
  }
  if (summary.searched > 0) {
    bits.push(
      `searched ${summary.searched} time${summary.searched === 1 ? "" : "s"}`,
    );
  }
  if (summary.ran > 0) {
    bits.push(
      `ran ${summary.ran} command${summary.ran === 1 ? "" : "s"}`,
    );
  }
  if (summary.edited > 0 && !summary.lastEditFile) {
    bits.push(
      `edited ${summary.edited} file${summary.edited === 1 ? "" : "s"}`,
    );
  }
  if (bits.length === 0) return "";
  const [first, ...rest] = bits;
  return `${first}${rest.length ? `, ${rest.join(", ")}` : ""}.`;
}

function liveActivityLabel(
  parts: readonly TimelinePart[],
  summary: ReturnType<typeof summarizeActivity>,
): string {
  const last = [...parts].reverse().find((part) => part.type === "tool-call");
  if (last?.type === "tool-call" && last.toolName === "edit_file") {
    const file =
      summary.lastEditFile ??
      chipFor(last) ??
      "file";
    const explored =
      summary.explored > 0
        ? `, explored ${summary.explored} file${summary.explored === 1 ? "" : "s"}`
        : "";
    return `Editing ${file}${explored}`;
  }
  const overview = formatActivitySummary(summary).replace(/\.$/, "");
  if (overview) return overview;
  if (last?.type === "tool-call") {
    const meta = TOOL_META[last.toolName];
    const chip = chipFor(last);
    if (chip) return `${meta?.verb ?? "Running"} ${chip}`;
  }
  return "Thinking…";
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

/**
 * One timeline segment for a contiguous slice of reasoning/tool parts.
 * Only the last segment may shimmer Working / show Worked-for.
 */
export const SessionTimelineSegment: FC<{
  readonly indices: readonly number[];
  /** Last timeline segment in the turn (owns settled “Worked for”). */
  readonly isLast: boolean;
  /**
   * Trailing work cluster — only this segment may shimmer Working.
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
  const toolCalls = useMemo(
    () => asTimelineParts(messageParts, indices),
    [messageParts, indices],
  );

  const liveEvents = useEveEvents();
  const events = overrideEvents ?? liveEvents;
  const showLive = live && (streaming || awaitingInput);
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
  const steps = toolCalls.map(toStep);
  const stats = toStats(toolCalls);
  const activity = useMemo(() => summarizeActivity(toolCalls), [toolCalls]);

  if (steps.length === 0) return null;

  const workedFor =
    isLast && !showLive
      ? (settledDuration ?? (streaming ? liveElapsed : undefined))
      : undefined;
  const duration = showLive ? liveElapsed : workedFor;
  const activitySummary = formatActivitySummary(activity);
  const restingLabel = workedFor
    ? activitySummary
      ? `Thought ${workedFor} · ${activitySummary.replace(/\.$/, "")}`
      : `Thought ${workedFor}`
    : activitySummary ||
      `${steps.length} step${steps.length === 1 ? "" : "s"}`;

  return (
    <ToolTimeline
      steps={steps}
      visibleSteps={steps.length}
      streaming={showLive}
      open={userOpen ?? showLive}
      onOpenChange={setUserOpen}
      restingLabel={restingLabel}
      activeLabel={liveActivityLabel(toolCalls, activity)}
      elapsed={showLive ? duration : undefined}
      stats={stats}
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
