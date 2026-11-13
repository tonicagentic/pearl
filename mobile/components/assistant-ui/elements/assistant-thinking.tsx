import { useAuiState } from "@assistant-ui/react-native";

import { ThinkingIndicator } from "@/components/assistant-ui/elements/thinking-indicator";
import {
  isTimelineToolCall,
  isTrailingContentPhase,
  splitAssistantBlocks,
  type AssistantMessagePart,
} from "@/components/assistant-ui/elements/session-timeline";
import { useTurnElapsed } from "@/components/assistant-ui/elements/turn-elapsed";

const STALL_WARNING_S = 45;
const STALL_LABEL = "Still working — the model may be slow or unreachable.";

/**
 * Bottom status for pre-content / uncovered tools. Hidden while the answer
 * streams (timeline already shows Worked for) and while a trailing timeline
 * owns live Working — except stall warnings during active work.
 */
export function AssistantThinking() {
  const label = useAuiState((s) => {
    if (s.message.status?.type !== "running") return undefined;
    const parts = s.message.parts as readonly AssistantMessagePart[];
    // Final (or mid-turn) prose / cards are on screen — no bottom spinner.
    if (isTrailingContentPhase(splitAssistantBlocks(parts))) return undefined;

    const pending = parts.find(
      (part) =>
        part.type === "tool-call" &&
        part.status?.type === "running" &&
        part.toolName !== "todo",
    );
    if (pending?.type === "tool-call") {
      // Trailing timeline segment already shows Working for covered tools.
      if (isTimelineToolCall(pending)) return undefined;
      return `Running ${pending.toolName}`;
    }

    const hasWork = parts.some(
      (part) =>
        part.type === "reasoning" ||
        part.type === "tool-call" ||
        part.type === "file" ||
        part.type === "image" ||
        (part.type === "text" &&
          typeof part.text === "string" &&
          part.text.trim().length > 0),
    );
    return hasWork ? undefined : "Thinking…";
  });

  const answerPhase = useAuiState((s) => {
    if (s.message.status?.type !== "running") return false;
    const parts = s.message.parts as readonly AssistantMessagePart[];
    return isTrailingContentPhase(splitAssistantBlocks(parts));
  });

  const trailingTimelineLive = useAuiState((s) => {
    if (s.message.status?.type !== "running") return false;
    const parts = s.message.parts as readonly AssistantMessagePart[];
    const blocks = splitAssistantBlocks(parts);
    if (isTrailingContentPhase(blocks)) return false;
    return blocks.length > 0 && blocks[blocks.length - 1]?.kind === "timeline";
  });

  const elapsed = useTurnElapsed();
  const seconds = Number.parseInt(elapsed ?? "0", 10);
  const stalled = Number.isFinite(seconds) && seconds > STALL_WARNING_S;

  // Answer text is the status; don't put Working/stall under it.
  if (answerPhase) return null;
  if (trailingTimelineLive && !stalled) return null;
  if (label === undefined && !stalled) return null;

  return (
    <ThinkingIndicator
      label={stalled ? STALL_LABEL : (label ?? "Thinking…")}
      elapsed={elapsed}
    />
  );
}
