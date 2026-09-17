import type { EveMessageData, MessageStreamEvent } from "eve/client";
import type { EveMessagePart } from "eve/react";
import { defaultMessageReducer } from "eve/react";

type ChatMessageReducer = {
  initial: () => EveMessageData;
  reduce: (data: EveMessageData, event: MessageStreamEvent) => EveMessageData;
};

// eve's message reducer leaves reasoning (and text) parts in `streaming` state
// when a turn completes or fails without an explicit part-completed event, so
// the chat UI keeps rendering "Thinking..." with the reasoning block forced
// open on finished responses. Wrap the default reducer and finalize streaming
// text/reasoning parts on turn boundaries, mirroring what eve already does for
// `turn.cancelled`.
export function createChatMessageReducer(): ChatMessageReducer {
  const reducer = defaultMessageReducer();

  return {
    initial: () => reducer.initial(),
    reduce: (data, event) => {
      const next = reducer.reduce(data, event);

      if (event.type === "turn.completed" || event.type === "turn.failed") {
        const finalized = finalizeStreamingParts(next, event.data.turnId);

        // A failed turn must never look like a finished response: mark the
        // message status so the UI presents it as failed, not streaming.
        if (event.type === "turn.failed") {
          return markTurnFailed(finalized, event.data.turnId);
        }

        return finalized;
      }

      return next;
    },
  };
}

function finalizeStreamingParts(
  data: EveMessageData,
  turnId: string,
): EveMessageData {
  return {
    ...data,
    messages: data.messages.map((message) =>
      message.role === "assistant" && message.metadata?.turnId === turnId
        ? { ...message, parts: message.parts.map(finalizeStreamingPart) }
        : message,
    ),
  };
}

function markTurnFailed(
  data: EveMessageData,
  turnId: string,
): EveMessageData {
  return {
    ...data,
    messages: data.messages.map((message) =>
      message.role === "assistant" && message.metadata?.turnId === turnId
        ? { ...message, metadata: { ...message.metadata, status: "failed" } }
        : message,
    ),
  };
}

function finalizeStreamingPart(part: EveMessagePart): EveMessagePart {
  if (
    (part.type === "text" || part.type === "reasoning") &&
    part.state === "streaming"
  ) {
    return { ...part, state: "done" };
  }

  return part;
}
