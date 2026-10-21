import { defaultMessageReducer, type EveMessageData, type EveMessagePart, type MessageStreamEvent } from "eve/client";

// Keep the native projection aligned with the web chat on terminal turn events.
// eve's default leaves incomplete text/reasoning parts and a failed assistant
// message in streaming state unless the individual part completed first.
export function createMobileMessageReducer() {
  const base = defaultMessageReducer();
  return {
    initial: () => base.initial(),
    reduce(data: EveMessageData, event: MessageStreamEvent): EveMessageData {
      const next = base.reduce(data, event);
      if (event.type !== "turn.completed" && event.type !== "turn.failed") return next;
      return {
        ...next,
        messages: next.messages.map((message) =>
          message.role === "assistant" && message.metadata?.turnId === event.data.turnId
            ? {
                ...message,
                metadata: event.type === "turn.failed"
                  ? { ...message.metadata, status: "failed" as const }
                  : message.metadata,
                parts: message.parts.map((part): EveMessagePart =>
                  (part.type === "text" || part.type === "reasoning") && part.state === "streaming"
                    ? { ...part, state: "done" }
                    : part,
                ),
              }
            : message,
        ),
      };
    },
  };
}
