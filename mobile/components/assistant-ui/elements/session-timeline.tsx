import { useMemo, useState } from "react";
import { useAuiState } from "@assistant-ui/react-native";

import { useEveEvents } from "@/src/chat-context";
import {
  ToolTimeline,
  type TimelineStat,
  type TimelineStep,
} from "./tool-timeline";
import { useElapsedLabel } from "./use-elapsed-label";

// RN port of the web session-timeline element: a whole working turn
// summarized as one collapsed line (verb + chip per tool step), with the
// covered tool/reasoning parts suppressed in the message parts.

type ToolCallState = {
  readonly type: "tool-call";
  readonly toolName: string;
  readonly args?: unknown;
  readonly result?: unknown;
  readonly toolCallId?: string;
};

type ReasoningState = {
  readonly type: "reasoning";
  readonly text?: string;
};

type TimelinePart = ToolCallState | ReasoningState;

// Tools summarized by the timeline (docs: elements/tool-timeline).
// write_file stays an artifact card on the web, ask_question stays an
// interactive card, and delegated subagent tasks render as task cards;
// everything else collapses into verbs, targets, and file stats.
export const TIMELINE_TOOLS = new Set([
  "edit_file",
  "read_file",
  "web_search",
  "web_fetch",
  "browser",
  "exa_agent_run",
  "file__save_memory",
  "file__remove_memory",
  "load_skill",
  "get_weather",
  "get_profile",
  "bash",
  "glob",
  "grep",
  "task_cancel",
  "send_notification",
  "read_attachment",
]);

const TOOL_META: Record<string, { verb: string }> = {
  edit_file: { verb: "Edited" },
  read_file: { verb: "Read" },
  web_search: { verb: "Searched" },
  web_fetch: { verb: "Fetched" },
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
  coder: { verb: "Delegated to coder" },
  deploy_vercel: { verb: "Deployed" },
  merge_pr: { verb: "Merged" },
  eas_build: { verb: "Started EAS build" },
  eas_submit: { verb: "Submitted to EAS" },
  run_with_env: { verb: "Ran with env" },
  preview_check: { verb: "Checked preview" },
  deployment_logs: { verb: "Fetched logs" },
};

function basename(path: string): string {
  return path.split("/").pop() || path;
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
  if (typeof args.message === "string") {
    return args.message.split("\n")[0].slice(0, 200);
  }
  return part.toolName;
}

function toStep(part: TimelinePart): TimelineStep {
  const args = (part.type === "tool-call" ? (part.args ?? {}) : {}) as {
    filePath?: unknown;
    skill?: unknown;
  };
  const filePath =
    typeof args.filePath === "string" ? args.filePath : undefined;
  if (part.type === "reasoning") {
    // Trace-style: title only. Prose stays behind expand, not in a chip.
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
    verb: meta?.verb ?? part.toolName,
    chip: chipFor(part).slice(0, 200),
    filePath,
  };
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
        added: args.newText?.length,
        removed: args.oldText?.length,
        filePath: args.filePath,
      };
    });
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

// A whole working turn summarized as one collapsed line. Rendered beside the
// message parts; the covered tool parts render null so nothing shows twice.
export function SessionTimeline() {
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const streaming = useAuiState((s) => s.message.status?.type === "running");
  const turnId = useAuiState(
    (s) => s.message.metadata?.custom?.turnId as string | undefined,
  );
  const toolCalls = (
    useAuiState((s) => s.message.parts) as readonly unknown[]
  ).filter(
    (part): part is TimelinePart =>
      typeof part === "object" &&
      part !== null &&
      ((part as { type?: string }).type === "reasoning" ||
        ((part as { type?: string }).type === "tool-call" &&
          TIMELINE_TOOLS.has((part as { toolName?: string }).toolName ?? ""))),
  );

  // Durable turn duration, derived from the persisted event log: first to
  // last event timestamp for this turn (each event carries meta.at and
  // data.turnId). Survives reloads — no wall clock at render.
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
      if (raw?.type === "message.received" || raw?.type === "delivery.consumed") continue; // user-side marker
      if (raw.data?.turnId !== turnId) continue;
      const at = raw.meta?.at;
      const ts = typeof at === "string" ? Date.parse(at) : NaN;
      if (!Number.isFinite(ts)) continue;
      start ??= ts;
      end = ts;
    }
    if (start === undefined || end === undefined) return undefined;
    return formatDuration(end - start);
  }, [events, streaming, turnId]);

  // Live tick while streaming; the settled badge comes from the event log.
  const liveElapsed = useElapsedLabel(streaming);

  const steps = toolCalls.map(toStep);
  const stats = toStats(toolCalls);

  if (steps.length === 0) return null;

  const duration = streaming ? liveElapsed : settledDuration;
  const restingLabel = settledDuration
    ? `Worked for ${settledDuration}`
    : `${steps.length} step${steps.length === 1 ? "" : "s"}${
        stats.length > 0
          ? ` · ${stats.length} file change${stats.length === 1 ? "" : "s"}`
          : ""
      }`;

  return (
    <ToolTimeline
      steps={steps}
      visibleSteps={steps.length}
      streaming={streaming}
      open={userOpen ?? streaming}
      onOpenChange={setUserOpen}
      restingLabel={restingLabel}
      activeLabel="Working"
      elapsed={duration}
      stats={stats}
    />
  );
}
