"use client";

import { useState } from "react";
import {
  BanIcon,
  BrainIcon,
  EyeIcon,
  FileSearchIcon,
  FolderSearchIcon,
  GlobeIcon,
  GraduationCapIcon,
  HeartIcon,
  ListTodoIcon,
  PaperclipIcon,
  PenLineIcon,
  SearchIcon,
  SendIcon,
  TerminalIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { useAuiState } from "@assistant-ui/react";

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
};

type ReasoningState = {
  readonly type: "reasoning";
  readonly text?: string;
};

type TimelinePart = ToolCallState | ReasoningState;

// Tools summarized by the timeline (docs: elements/tool-timeline — with a
// runtime you derive the steps from the message's own tool-call parts).
// write_file stays an artifact card (it owns the canvas entry point),
// ask_question stays an interactive card (human input), and delegated
// subagent tasks render as task cards (elements/task-card); everything else
// collapses into verbs, targets, and file stats.
export const TIMELINE_TOOLS = new Set([
  "edit_file",
  "read_file",
  "web_search",
  "web_fetch",
  "exa_agent_run",
  "file__save_memory",
  "file__remove_memory",
  "load_skill",
  "get_weather",
  "bash",
  "glob",
  "grep",
  "todo",
  "task_cancel",
  "send_notification",
  "read_attachment",
]);

const TOOL_META: Record<string, { verb: string; icon: LucideIcon }> = {
  edit_file: { verb: "Edited", icon: PenLineIcon },
  read_file: { verb: "Read", icon: EyeIcon },
  web_search: { verb: "Searched", icon: SearchIcon },
  web_fetch: { verb: "Fetched", icon: GlobeIcon },
  exa_agent_run: { verb: "Researched", icon: GlobeIcon },
  file__save_memory: { verb: "Remembered", icon: BrainIcon },
  file__remove_memory: { verb: "Forgot", icon: HeartIcon },
  load_skill: { verb: "Loaded", icon: GraduationCapIcon },
  get_weather: { verb: "Checked", icon: GlobeIcon },
  bash: { verb: "Ran", icon: TerminalIcon },
  glob: { verb: "Listed", icon: FolderSearchIcon },
  grep: { verb: "Searched", icon: FileSearchIcon },
  todo: { verb: "Planned", icon: ListTodoIcon },
  task_cancel: { verb: "Cancelled", icon: BanIcon },
  send_notification: { verb: "Notified", icon: SendIcon },
  read_attachment: { verb: "Read attachment", icon: PaperclipIcon },
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
  if (part.type === "reasoning") {
    const head = (part.text ?? "").replace(/\s+/g, " ").trim();
    return {
      verb: "Thought",
      chip: head.slice(0, 200) || "…",
      icon: BrainIcon,
      // The full reasoning prose, revealed by expanding the step.
      detail: part.text,
    };
  }
  const meta = TOOL_META[part.toolName];
  return {
    verb: meta?.verb ?? part.toolName,
    chip: chipFor(part).slice(0, 200),
    icon: meta?.icon ?? WrenchIcon,
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
      };
    });
}

// A whole working turn summarized as one collapsed line: a verb, an icon, and
// a chip per tool step, ending in file-change stats (docs:
// elements/tool-timeline). Rendered beside the message parts; the covered
// tool parts render null so nothing shows twice.
export function SessionTimeline() {
  // Open-state contract from the docs' step-panel design: the timeline follows
  // streaming (open while the turn runs, folded into the resting label after)
  // until the reader toggles it once, after which their choice sticks.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
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
  const streaming = useAuiState((s) => s.message.status?.type === "running");
  // The elapsed badge lives on the timeline's active label for the whole run —
  // the indicator's clock hands off here, so the turn shows one continuous
  // count instead of restarting per tool call.
  const elapsed = useElapsedLabel(streaming);
  const steps = toolCalls.map(toStep);
  const stats = toStats(toolCalls);

  if (steps.length === 0) return null;

  return (
    <ToolTimeline
      steps={steps}
      visibleSteps={steps.length}
      streaming={streaming}
      open={userOpen ?? streaming}
      onOpenChange={setUserOpen}
      restingLabel={`${steps.length} step${steps.length === 1 ? "" : "s"}${
        stats.length > 0 ? ` · ${stats.length} file change${stats.length === 1 ? "" : "s"}` : ""
      }`}
      activeLabel="Working"
      elapsed={elapsed}
      stats={stats}
    />
  );
}
