"use client";

import { useMemo, useState } from "react";
import { useAuiState } from "@assistant-ui/react";
import { useEveEvents } from "@assistant-ui/eve";

import { useCanvas } from "@/components/assistant-ui/elements/canvas-context";
import { DELEGATION_TOOLS } from "@/components/assistant-ui/elements/task-card.aui";

import {
  ToolTimeline,
  type TimelineStat,
  type TimelineStep,
} from "@/components/assistant-ui/elements/tool-timeline";
import { useElapsedLabel } from "@/components/assistant-ui/elements/use-elapsed-label";

// The runtime part state for a tool call or reasoning (shape per docs:
// elements/tool-timeline).
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
  create_issue: { verb: "Create issue" },
  list_issues: { verb: "List issues" },
  resolve_issue: { verb: "Resolve issue" },
  deploy_vercel: { verb: "Deployed" },
  merge_pr: { verb: "Merged" },
  eas_build: { verb: "Started EAS build" },
  eas_submit: { verb: "Submitted to EAS" },
  run_with_env: { verb: "Ran with env" },
  preview_check: { verb: "Checked preview" },
  deployment_logs: { verb: "Opened logs" },
};

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

function humanizeToolName(toolName: string): string {
  const bare = toolName.includes("__")
    ? (toolName.split("__").pop() ?? toolName)
    : toolName;
  const spaced = bare.replace(/[_-]+/g, " ").trim();
  if (!spaced) return toolName;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function basename(path: string): string {
  return path.split("/").pop() || path;
}

/** Hostname (+ useful path) for a page URL; empty when the value is not a URL. */
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
  return humanizeToolName(part.toolName);
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
        ? String(
            (part.result as { error?: unknown }).error ?? "Could not load skill",
          )
        : `Loaded ${skillName}`,
      filePath,
    };
  }
  return {
    verb: meta?.verb ?? humanizeToolName(part.toolName),
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

// A whole working turn summarized as one collapsed line: a verb and a chip
// per tool step, ending in file-change stats (docs:
// elements/tool-timeline). Rendered beside the message parts; the covered
// tool parts render null so nothing shows twice.
export function SessionTimeline() {
  const { openPath } = useCanvas();
  // Open-state contract from the docs' step-panel design: the timeline follows
  // streaming (open while the turn runs, folded into the resting label after)
  // until the reader toggles it once, after which their choice sticks.
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
