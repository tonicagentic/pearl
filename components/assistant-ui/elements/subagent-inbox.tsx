"use client";

import { useEffect, useMemo, useState } from "react";
import { useEveEvents } from "@assistant-ui/eve";

import {
  BackgroundInbox,
  type BackgroundRun,
} from "@/components/assistant-ui/elements/background-inbox";
import {
  deriveSubagentRuns,
  SLOW_REVIEW_S,
} from "@/lib/agent/subagent-runs";

// The runtime wiring for the background inbox (docs:
// elements/background-inbox — standalone mode: we hold the run list ourselves).
// The run list derives from the persisted subagent event stream
// (lib/agent/subagent-runs.ts): delegations are durable background tasks whose
// receipts live in the chat event log, so rows survive reloads.

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function runSummary(run: {
  readonly state: string;
  readonly result?: unknown;
}): string | undefined {
  if (run.state === "failed") {
    return "no result arrived — the run was likely interrupted by a restart; ask for the review again";
  }
  if (run.state === "running") {
    return "grades coherence, flow, and audience fit";
  }
  const review = run.result as
    | {
        coherence?: { score?: number };
        flow?: { score?: number };
        audienceFit?: { score?: number };
      }
    | undefined;
  const coherence = review?.coherence?.score;
  const flow = review?.flow?.score;
  const audience = review?.audienceFit?.score;
  if (
    typeof coherence !== "number" ||
    typeof flow !== "number" ||
    typeof audience !== "number"
  ) {
    return "review ready — see the reply below";
  }
  return `coherence ${coherence}/10 · flow ${flow}/10 · audience ${audience}/10`;
}

function runTitle(name: string): string {
  return name === "editor" ? "Editor review" : `${name} run`;
}

export function SubagentInbox() {
  const events = useEveEvents();
  const [now, setNow] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  const runs = useMemo(
    () => deriveSubagentRuns(events, now ?? Number.MAX_SAFE_INTEGER),
    [events, now],
  );

  const visible = runs
    .filter((run) => !dismissed.has(run.callId))
    .map((run) => ({
      id: run.callId,
      title: runTitle(run.name),
      state: run.state,
      // Elapsed ticks while a run is in flight; settled runs freeze at the
      // last tick (the derivation's `now` only advances while anything runs).
      elapsed:
        run.state === "running" && now !== null
          ? formatElapsed(now - run.at)
          : formatElapsed((now ?? run.at) - run.at),
      summary: runSummary(run),
    }));

  const anyRunning = runs.some((run) => run.state === "running");

  useEffect(() => {
    if (!anyRunning) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [anyRunning]);

  if (visible.length === 0) {
    return null;
  }

  const collect = (id: string) => {
    // The results land in this same thread as the follow-up turn; collecting a
    // run scrolls to the reply and clears the row.
    const thread = document.querySelector(
      "[data-slot=aui_assistant-message-content]",
    );
    thread?.scrollIntoView({ behavior: "smooth", block: "end" });
    setDismissed((prev) => new Set(prev).add(id));
  };

  return (
    <BackgroundInbox
      runs={visible}
      onCollect={collect}
      data-testid="subagent-inbox"
      className="w-full max-w-none"
    />
  );
}
