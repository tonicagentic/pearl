import { toActivityStep } from "@/lib/thread-activity";

/**
 * How a tool call appears in Pearl chat (web). Keep in sync with
 * `isStandaloneTool` / DELEGATION_TOOLS in session-timeline + task-card.
 */

export type ToolUiSurface =
  | "timeline"
  | "task_card"
  | "artifact_card"
  | "image_card"
  | "svg_card"
  | "browser_chip"
  | "desktop_chip"
  | "hidden"
  | "fallback";

export type ToolUiPresentation = {
  readonly surface: ToolUiSurface;
  readonly label: string;
  readonly summary: string;
  /** Optional timeline verb when surface is timeline. */
  readonly timelineVerb?: string;
  readonly timelineChip?: string;
};

/** Same set as `DELEGATION_TOOLS` in task-card.aui.tsx (minus generic `agent`). */
const DELEGATION = new Set([
  "agent",
  "coder",
  "designer",
  "editor",
  "list-builder",
  "mail",
  "researcher",
  "reviewer",
  "updates",
]);

const SURFACE_LABEL: Record<ToolUiSurface, string> = {
  timeline: "Timeline step",
  task_card: "Task card",
  artifact_card: "Artifact card",
  image_card: "Image card",
  svg_card: "SVG card",
  browser_chip: "Browser chip",
  desktop_chip: "Desktop chip",
  hidden: "Hidden",
  fallback: "Fallback / HITL",
};

function defaultTimeline(toolName: string): ToolUiPresentation {
  const step = toActivityStep(
    {
      type: "tool-call",
      toolName,
      args: {},
      status: { type: "complete" },
    },
    { live: false },
  );
  return {
    surface: "timeline",
    label: SURFACE_LABEL.timeline,
    summary:
      "Folded into the session timeline (verb + chip). No standalone card " +
      "unless the call is parked for approval — then ToolFallback mounts.",
    timelineVerb: step.verb,
    timelineChip: step.chip || toolName,
  };
}

/**
 * Resolve how `toolName` renders in chat. Connection MCP tools and most
 * authored tools use the timeline; a small set have dedicated cards.
 */
export function resolveToolUiPresentation(
  toolName: string,
  opts?: { readonly kind?: string },
): ToolUiPresentation {
  if (toolName === "todo") {
    return {
      surface: "hidden",
      label: SURFACE_LABEL.hidden,
      summary:
        "Not shown as its own card — todo updates are absorbed into the " +
        "session timeline / chrome.",
    };
  }

  if (DELEGATION.has(toolName) || opts?.kind === "subagent") {
    return {
      surface: "task_card",
      label: SURFACE_LABEL.task_card,
      summary:
        "Standalone subagent row (:: mark, label, model, activity). Opens a " +
        "task card while the child runs.",
    };
  }

  if (toolName === "write_file") {
    return {
      surface: "artifact_card",
      label: SURFACE_LABEL.artifact_card,
      summary:
        "Standalone ArtifactCard (path + size). Claims the canvas while " +
        "writing; click toggles the document pane.",
    };
  }

  if (toolName === "edit_file") {
    return {
      surface: "timeline",
      label: SURFACE_LABEL.timeline,
      summary:
        "Usually a timeline “Edited …” step; the edit_file ToolUI is silent " +
        "in the group (timeline owns the row).",
      timelineVerb: "Edited",
      timelineChip: "file",
    };
  }

  if (toolName === "read_file") {
    return {
      surface: "timeline",
      label: SURFACE_LABEL.timeline,
      summary:
        "Timeline “Read …” step only — ReadFileToolUI renders null to avoid " +
        "duplicating the timeline.",
      timelineVerb: "Read",
      timelineChip: "file",
    };
  }

  if (toolName === "generate_image") {
    return {
      surface: "image_card",
      label: SURFACE_LABEL.image_card,
      summary:
        "Standalone image placeholder while generating, then a zoomable " +
        "preview with filename actions.",
    };
  }

  if (toolName === "generate_svg") {
    return {
      surface: "svg_card",
      label: SURFACE_LABEL.svg_card,
      summary:
        "Standalone SVG / artifact preview in the thread (and canvas when " +
        "opened).",
    };
  }

  if (toolName === "browser") {
    return {
      surface: "browser_chip",
      label: SURFACE_LABEL.browser_chip,
      summary:
        "Compact browser chip in-thread; live pages sync into the Computer / " +
        "canvas browser pane.",
    };
  }

  if (toolName === "desktop") {
    return {
      surface: "desktop_chip",
      label: SURFACE_LABEL.desktop_chip,
      summary:
        "Compact desktop chip; start opens the sandbox screen-relay in Computer.",
    };
  }

  // Connection MCP tools and everything else → timeline (+ HITL fallback).
  if (opts?.kind === "connection") {
    return {
      surface: "timeline",
      label: SURFACE_LABEL.timeline,
      summary:
        "MCP connection tool — timeline step when running/settled; ToolFallback " +
        "card when approval is required.",
      timelineVerb: "Called",
      timelineChip: toolName,
    };
  }

  return defaultTimeline(toolName);
}

export function toolUiSurfaceLabel(surface: ToolUiSurface): string {
  return SURFACE_LABEL[surface];
}
