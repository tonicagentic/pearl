/** Keep in sync with DELEGATION_TOOLS in task-card.aui.tsx. */
const DELEGATION_TOOLS = new Set([
  "agent",
  "coder",
  "editor",
  "researcher",
  "reviewer",
]);

export type AssistantMessagePart = {
  readonly type?: string;
  readonly text?: string;
  readonly toolName?: string;
  readonly status?: { readonly type?: string };
  readonly args?: { readonly options?: readonly unknown[] };
  readonly approval?: {
    readonly display?: string;
    readonly approved?: boolean;
    readonly options?: readonly unknown[];
  };
};

export type AssistantTimelineBlock = {
  readonly kind: "timeline";
  readonly indices: readonly number[];
};

export type AssistantContentBlock = {
  readonly kind: "content";
  readonly indices: readonly number[];
};

export type AssistantBlock = AssistantTimelineBlock | AssistantContentBlock;

/** Tools that keep their own card instead of a timeline step. */
export function isStandaloneTool(toolName: string): boolean {
  return (
    toolName === "todo" ||
    toolName === "write_file" ||
    toolName === "generate_image" ||
    DELEGATION_TOOLS.has(toolName)
  );
}

/**
 * Whether a message part is summarized by the session timeline (and should
 * render nothing in the content body).
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

function isTimelineBlockPart(part: AssistantMessagePart | null | undefined): boolean {
  if (!part) return false;
  if (part.type === "reasoning") return true;
  return isTimelineToolCall(part);
}

/** Visible content that splits the tool timeline (text, media, standalones). */
export function isContentBlockPart(
  part: AssistantMessagePart | null | undefined,
): boolean {
  if (!part) return false;
  if (part.type === "text") {
    return typeof part.text === "string" && part.text.trim().length > 0;
  }
  if (part.type === "image" || part.type === "file" || part.type === "data") {
    return true;
  }
  if (part.type === "tool-call") {
    if (part.toolName === "todo") return false;
    return !isTimelineCoveredPart(part);
  }
  return false;
}

/**
 * Split assistant parts into interleaved timeline / content blocks.
 * Contiguous reasoning + timeline tools stay together until a visible
 * content part arrives; then a new timeline can start below that content.
 */
export function splitAssistantBlocks(
  parts: readonly AssistantMessagePart[],
): readonly AssistantBlock[] {
  const blocks: AssistantBlock[] = [];
  let timeline: number[] = [];
  let content: number[] = [];

  const flushTimeline = () => {
    if (timeline.length === 0) return;
    blocks.push({ kind: "timeline", indices: timeline });
    timeline = [];
  };
  const flushContent = () => {
    if (content.length === 0) return;
    blocks.push({ kind: "content", indices: content });
    content = [];
  };

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (isTimelineBlockPart(part)) {
      flushContent();
      timeline.push(index);
      continue;
    }
    if (isContentBlockPart(part)) {
      flushTimeline();
      content.push(index);
      continue;
    }
  }

  flushTimeline();
  flushContent();
  return blocks;
}

/** Index of the last timeline block, or -1 when none. */
export function lastTimelineBlockIndex(
  blocks: readonly AssistantBlock[],
): number {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (blocks[index]?.kind === "timeline") return index;
  }
  return -1;
}

/**
 * True when the trailing block is visible content (answer / standalone card).
 * Work should settle then: no live Working, no bottom status while text streams.
 */
export function isTrailingContentPhase(
  blocks: readonly AssistantBlock[],
): boolean {
  if (blocks.length === 0) return false;
  return blocks[blocks.length - 1]?.kind === "content";
}

function isOpenQuestionPart(part: AssistantMessagePart): boolean {
  if (part.type !== "tool-call") return false;
  if (part.toolName === "ask_question") {
    return (
      part.status?.type === "requires-action" ||
      (part.approval != null && part.approval.approved === undefined)
    );
  }
  const display = part.approval?.display;
  if (display !== "select" && display !== "text") return false;
  return part.approval?.approved === undefined;
}

function questionHasChoices(part: AssistantMessagePart): boolean {
  if (part.approval?.display === "text") return false;
  if (part.approval?.display === "select") return true;
  const options = part.approval?.options ?? part.args?.options;
  return Array.isArray(options) && options.length > 0;
}

/**
 * True when the assistant turn is parked on an unanswered ask_question
 * (select / free-text). Approvals and sign-in are not questions.
 */
export function hasOpenQuestion(
  parts: readonly AssistantMessagePart[],
): boolean {
  return parts.some(isOpenQuestionPart);
}

/**
 * True when an open question morphs the composer (choice / select chips).
 * Text-only freeform asks stay in the normal composer — no "Asking questions"
 * chrome.
 */
export function hasComposerOpenQuestion(
  parts: readonly AssistantMessagePart[],
): boolean {
  return parts.some(
    (part) => isOpenQuestionPart(part) && questionHasChoices(part),
  );
}
