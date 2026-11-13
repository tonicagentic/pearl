import type {
  ConversationAgentSession,
  EveMessage,
  EveMessagePart,
} from "eve/client";

function partLines(part: EveMessagePart): readonly string[] {
  if (part.type === "text" || part.type === "reasoning") {
    const text = typeof part.text === "string" ? part.text.trim() : "";
    if (!text) return [];
    return [part.type === "reasoning" ? `Thought · ${text}` : text];
  }
  if (part.type === "tool") {
    const status =
      part.state === "completed"
        ? "done"
        : part.state === "failed" ||
            part.state === "rejected" ||
            part.state === "cancelled"
          ? part.state
          : "running";
    const input =
      part.state !== "streaming" &&
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
    return [`${part.name}${chip ? ` · ${chip}` : ""} (${status})`];
  }
  if (part.type === "interaction") {
    const prompt = part.request.prompt ?? part.request.kind;
    return [
      part.status === "open" ? `Waiting · ${prompt}` : `Settled · ${prompt}`,
    ];
  }
  return [];
}

/** Per-message display blocks for the subagent transcript sheet. */
export function subagentMessageBlocks(
  messages: readonly EveMessage[],
): readonly {
  readonly id: string;
  readonly role: "assistant" | "user";
  readonly lines: readonly string[];
}[] {
  return messages.flatMap((message) => {
    const lines = message.parts.flatMap((part) => [...partLines(part)]);
    if (lines.length === 0) return [];
    return [{ id: message.id, role: message.role, lines }];
  });
}

/** Flatten followed child messages into display lines (newest last). */
export function subagentTranscriptLines(
  messages: readonly EveMessage[],
): readonly string[] {
  return subagentMessageBlocks(messages).flatMap((block) => [...block.lines]);
}

/**
 * Latest visible line from a followed child session, or null when the
 * stream is not available / empty yet.
 */
export function latestSubagentPreviewLine(
  agent: ConversationAgentSession | undefined,
): string | null {
  if (!agent || agent.observation.status === "not-followed") return null;
  const lines = subagentTranscriptLines(agent.observation.conversation.messages);
  const last = lines[lines.length - 1];
  if (!last) return null;
  return last.length > 140 ? `${last.slice(0, 137).trimEnd()}…` : last;
}
