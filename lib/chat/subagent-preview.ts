/**
 * Flatten followed-child messages into short display lines for the task-card
 * transcript. Shared by web (in-card expand) and mobile (sheet).
 */

export type SubagentPreviewPart = {
  readonly type?: string;
  readonly text?: string;
  readonly name?: string;
  readonly state?: string;
  readonly status?: string;
  readonly input?: unknown;
  readonly request?: { readonly prompt?: string; readonly kind?: string };
};

export type SubagentPreviewMessage = {
  readonly id?: string;
  readonly role?: string;
  readonly parts?: readonly SubagentPreviewPart[];
};

function partLines(part: SubagentPreviewPart): readonly string[] {
  if (part.type === "text" || part.type === "reasoning") {
    const text = typeof part.text === "string" ? part.text.trim() : "";
    if (!text) return [];
    return [part.type === "reasoning" ? `Thought · ${text}` : text];
  }
  if (part.type === "tool" || part.type === "tool-call") {
    const state = part.state ?? part.status;
    const status =
      state === "completed" || state === "complete" || state === "done"
        ? "done"
        : state === "failed" ||
            state === "rejected" ||
            state === "cancelled" ||
            state === "canceled"
          ? state
          : "running";
    const input =
      state !== "streaming" &&
      part.input &&
      typeof part.input === "object" &&
      !Array.isArray(part.input)
        ? (part.input as Record<string, unknown>)
        : null;
    const chip =
      (typeof input?.filePath === "string" && input.filePath) ||
      (typeof input?.command === "string" && input.command) ||
      (typeof input?.query === "string" && input.query) ||
      (typeof input?.message === "string" &&
        input.message.split("\n")[0]?.slice(0, 120)) ||
      "";
    const name = part.name ?? "tool";
    return [`${name}${chip ? ` · ${chip}` : ""} (${status})`];
  }
  if (part.type === "interaction") {
    const prompt = part.request?.prompt ?? part.request?.kind ?? "wait";
    const open = part.status === "open" || part.state === "open";
    return [open ? `Waiting · ${prompt}` : `Settled · ${prompt}`];
  }
  return [];
}

/** Per-message display blocks for the subagent transcript. */
export function subagentMessageBlocks(
  messages: readonly SubagentPreviewMessage[],
): readonly {
  readonly id: string;
  readonly role: "assistant" | "user";
  readonly lines: readonly string[];
}[] {
  return messages.flatMap((message, index) => {
    const lines = (message.parts ?? []).flatMap((part) => [...partLines(part)]);
    if (lines.length === 0) return [];
    const role = message.role === "user" ? "user" : "assistant";
    return [
      {
        id: message.id ?? `${role}-${index}`,
        role,
        lines,
      },
    ];
  });
}

/** Flatten followed child messages into display lines (newest last). */
export function subagentTranscriptLines(
  messages: readonly SubagentPreviewMessage[],
): readonly string[] {
  return subagentMessageBlocks(messages).flatMap((block) => [...block.lines]);
}
