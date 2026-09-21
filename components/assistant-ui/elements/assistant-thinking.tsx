"use client";

import { useEffect, useState } from "react";
import { useAuiState } from "@assistant-ui/react";
import { ThinkingIndicator } from "@/components/assistant-ui/elements/thinking-indicator";

import { TIMELINE_TOOLS } from "./session-timeline";

// In-thread agent status, following the assistant-ui thinking-indicator
// runtime recipe (assistant-ui.com/elements/thinking-indicator): the label is
// the pending tool call's name, falling back to "Thinking" while the run is
// active and nothing visible has arrived yet. Once the assistant streams real
// content the selector returns undefined and the indicator yields to it —
// inside the same assistant message row, so there is no remount.
//
// Coexistence with the SessionTimeline (which renders right below this and
// names every reasoning/tool step live): once the timeline has signal for the
// turn, it owns the live view and this indicator steps back — otherwise every
// covered tool call would read twice ("Running edit_file" above a shimmering
// "Edited" step). The indicator keeps two jobs: the pre-content phase (before
// any part exists) and uncovered tools like write_file, whose streaming the
// timeline does not summarize. The stall watchdog still wins over the
// timeline: after 45s without progress the escalation must surface even
// though the timeline is showing live steps.
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

  // Whether the timeline below is already carrying a live view of this turn.
  const timelineLive = useAuiState((s) => {
    if (s.message.status?.type !== "running") return false;
    return s.message.parts.some(
      (part) =>
        part.type === "reasoning" ||
        (part.type === "tool-call" && TIMELINE_TOOLS.has(part.toolName)),
    );
  });

  const elapsed = useElapsedLabel(label !== undefined);
  if (label === undefined) return null;

  const seconds = Number.parseInt(elapsed ?? "0", 10);
  const stalled = Number.isFinite(seconds) && seconds > STALL_WARNING_S;
  // The timeline owns the live steps; only the stall escalation overrides it.
  if (timelineLive && !stalled) return null;

  return (
    <ThinkingIndicator
      label={stalled ? STALL_LABEL : label}
      elapsed={elapsed}
      data-testid="assistant-thinking"
    />
  );
}
