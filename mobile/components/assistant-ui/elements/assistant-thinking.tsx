import { useAuiState } from "@assistant-ui/react-native";

import { ThinkingIndicator } from "@/components/assistant-ui/elements/thinking-indicator";
import { useElapsedLabel } from "@/components/assistant-ui/elements/use-elapsed-label";
import { TIMELINE_TOOLS } from "@/components/assistant-ui/elements/session-timeline";

const STALL_WARNING_S = 45;
const STALL_LABEL = "Still working — the model may be slow or unreachable.";

/** Pre-content / uncovered-tool status line; yields to SessionTimeline when it is live. */
export function AssistantThinking() {
  const label = useAuiState((s) => {
    if (s.message.status?.type !== "running") return undefined;
    const pending = s.message.parts.find(
      (part) => part.type === "tool-call" && part.status.type === "running",
    );
    if (pending?.type === "tool-call") return `Running ${pending.toolName}`;
    const hasContent = s.message.parts.some(
      (part) =>
        part.type === "text"
        || part.type === "reasoning"
        || part.type === "tool-call"
        || part.type === "file"
        || part.type === "image",
    );
    return hasContent ? undefined : "Thinking";
  });

  const timelineLive = useAuiState((s) => {
    if (s.message.status?.type !== "running") return false;
    return s.message.parts.some(
      (part) =>
        part.type === "reasoning"
        || (part.type === "tool-call" && TIMELINE_TOOLS.has(part.toolName)),
    );
  });

  const elapsed = useElapsedLabel(label !== undefined);
  if (label === undefined) return null;

  const seconds = Number.parseInt(elapsed ?? "0", 10);
  const stalled = Number.isFinite(seconds) && seconds > STALL_WARNING_S;
  if (timelineLive && !stalled) return null;

  return (
    <ThinkingIndicator
      label={stalled ? STALL_LABEL : label}
      elapsed={elapsed}
    />
  );
}
