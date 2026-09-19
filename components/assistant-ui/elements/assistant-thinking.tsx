"use client";

import { useEffect, useState } from "react";
import { useAuiState } from "@assistant-ui/react";
import { ThinkingIndicator } from "@/components/assistant-ui/elements/thinking-indicator";

// In-thread agent status, following the assistant-ui thinking-indicator
// runtime recipe (assistant-ui.com/elements/thinking-indicator): the label is
// the pending tool call's name, falling back to "Thinking" while the run is
// active and nothing visible has arrived yet. Once the assistant streams real
// content the selector returns undefined and the indicator yields to it —
// inside the same assistant message row, so there is no remount.
//
// The elapsed badge needs its own timer (docs: metadata.timing only finalizes
// once the message stops streaming). The clock starts in an effect, which also
// keeps the Cache Components shell deterministic (no wall clock at render).
//
// Stall watchdog: after 45s of running without visible progress the label
// escalates so a dead gateway call reads as text, not an endless shimmer.

const STALL_WARNING_S = 45;
const STALL_LABEL = "Still working — the model may be slow or unreachable.";

function useElapsedLabel(active: boolean) {
  const [label, setLabel] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!active) {
      setLabel(undefined);
      return;
    }
    const start = Date.now();
    setLabel("0s");
    const id = window.setInterval(() => {
      setLabel(`${Math.round((Date.now() - start) / 1000)}s`);
    }, 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return label;
}

export function AssistantThinking() {
  const label = useAuiState((s) => {
    if (s.message.status?.type !== "running") return undefined;
    const pending = s.message.parts.find(
      (part) => part.type === "tool-call" && part.status.type === "running",
    );
    if (pending?.type === "tool-call") return `Running ${pending.toolName}`;
    // The runtime emits a placeholder "indicator" part while a message has no
    // content yet; only real content parts hand the row over to the message.
    const hasContent = s.message.parts.some(
      (part) =>
        part.type === "text" ||
        part.type === "reasoning" ||
        part.type === "tool-call" ||
        part.type === "file" ||
        part.type === "image",
    );
    return hasContent ? undefined : "Thinking";
  });

  const elapsed = useElapsedLabel(label !== undefined);
  if (label === undefined) return null;

  const seconds = Number.parseInt(elapsed ?? "0", 10);
  return (
    <ThinkingIndicator
      label={Number.isFinite(seconds) && seconds > STALL_WARNING_S ? STALL_LABEL : label}
      elapsed={elapsed}
      data-testid="assistant-thinking"
    />
  );
}
