"use client";

import { useState } from "react";
import {
  BrainIcon,
  EyeIcon,
  FileTextIcon,
  GlobeIcon,
  GraduationCapIcon,
  HeartIcon,
  PenLineIcon,
  SearchIcon,
  UserRoundCheckIcon,
  type LucideIcon,
} from "lucide-react";
import { useAuiState } from "@assistant-ui/react";

import {
  ToolTimeline,
  type TimelineStat,
  type TimelineStep,
} from "@/components/assistant-ui/elements/tool-timeline";

// The runtime part state for a tool call (shape per docs: elements/tool-timeline).
type ToolCallState = {
  readonly type: "tool-call";
  readonly toolName: string;
  readonly args?: unknown;
  readonly result?: unknown;
  readonly toolCallId?: string;
};

// Tools summarized by the timeline (docs: elements/tool-timeline — with a
// runtime you derive the steps from the message's own tool-call parts).
// write_file stays an artifact card (it owns the canvas entry point) and
// ask_question stays an interactive card (human input); everything else
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
};

function basename(path: string): string {
  return path.split("/").pop() || path;
}

function toStep(part: ToolCallState): TimelineStep {
  const meta = TOOL_META[part.toolName];
  const args = (part.args ?? {}) as Record<string, unknown>;
  const chip =
    typeof args.filePath === "string"
      ? basename(args.filePath)
      : typeof args.query === "string"
        ? args.query
        : typeof args.skill === "string"
          ? args.skill
          : part.toolName;
  return {
    verb: meta?.verb ?? part.toolName,
    chip: chip.length > 42 ? `${chip.slice(0, 40)}…` : chip,
    icon: meta?.icon ?? FileTextIcon,
  };
}

function toStats(parts: readonly ToolCallState[]): TimelineStat[] {
  return parts
    .filter((part) => part.toolName === "edit_file")
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
  const [open, setOpen] = useState(false);
  const toolCalls = (
    useAuiState((s) => s.message.parts) as readonly unknown[]
  ).filter(
    (part): part is ToolCallState =>
      typeof part === "object" &&
      part !== null &&
      (part as { type?: string }).type === "tool-call" &&
      TIMELINE_TOOLS.has((part as { toolName?: string }).toolName ?? ""),
  );
  const streaming = useAuiState((s) => s.message.status?.type === "running");
  const steps = toolCalls.map(toStep);
  const stats = toStats(toolCalls);

  if (steps.length === 0) return null;

  return (
    <ToolTimeline
      steps={steps}
      visibleSteps={steps.length}
      streaming={streaming}
      open={open}
      onOpenChange={setOpen}
      restingLabel={`${steps.length} step${steps.length === 1 ? "" : "s"}${
        stats.length > 0 ? ` · ${stats.length} file change${stats.length === 1 ? "" : "s"}` : ""
      }`}
      activeLabel="Working"
      stats={stats}
    />
  );
}
