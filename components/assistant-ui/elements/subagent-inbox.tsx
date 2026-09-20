"use client";

import { useEffect, useMemo, useState } from "react";
import { useEveEvents } from "@assistant-ui/eve";

import {
  BackgroundInbox,
  type BackgroundRun,
} from "@/components/assistant-ui/elements/background-inbox";

// The runtime wiring for the background inbox (docs:
// elements/background-inbox — standalone mode: we hold the run list ourselves).
// eve subagent delegations run as durable background tasks, and the event log
// carries the whole lifecycle: `subagent.called` starts a run (with the child
// session id), `subagent.completed` with a backgroundTask is the tool call's
// working receipt, and the final completion carries the child's structured
// output. Rows survive reloads because the events persist in the chat log.

const SLOW_REVIEW_S = 180;

type StreamEvent = {
  readonly type?: string;
  readonly meta?: { readonly at?: string };
  readonly data?: {
    readonly subagentName?: string;
    readonly name?: string;
    readonly callId?: string;
    readonly output?: unknown;
    readonly backgroundTask?: { readonly status?: string };
  };
};

type Delegation = {
  callId: string;
  name: string;
  at: number;
  delivered: boolean;
  result?: unknown;
};

function eventTime(event: StreamEvent): number {
  const at = event.meta?.at ? Date.parse(event.meta.at) : NaN;
  return Number.isFinite(at) ? at : 0;
}

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function reviewSummary(result: unknown): string | undefined {
  const review = result as
    | {
        coherence?: { score?: number };
        flow?: { score?: number };
        audienceFit?: { score?: number };
      }
    | undefined;
  const coherence = review?.coherence?.score;
  const flow = review?.flow?.score;
  const audience = review?.audienceFit?.score;
  if (typeof coherence !== "number" || typeof flow !== "number" || typeof audience !== "number") {
    return "review ready — see the reply below";
  }
  return `coherence ${coherence}/10 · flow ${flow}/10 · audience ${audience}/10`;
}

export function SubagentInbox() {
  const events = useEveEvents();
  const [now, setNow] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  const delegations = useMemo<readonly Delegation[]>(() => {
    const list: Delegation[] = [];

    for (const raw of events) {
      const event = raw as StreamEvent;

      // subagent.called: the delegation — a run starts. Carries the child
      // session id and the tool name.
      if (event.type === "subagent.called") {
        const callId = event.data?.callId ?? String(list.length);
        const at = eventTime(event);
        if (at >= (list[list.length - 1]?.at ?? 0)) {
          list.push({
            callId,
            name: event.data?.name ?? "subagent",
            at,
            delivered: false,
          });
        }
        continue;
      }

      // subagent.completed comes in two shapes: the background-task receipt
      // (the tool call returning "working" — carries backgroundTask) and the
      // final completion (carries the child's output, no backgroundTask).
      if (event.type === "subagent.completed") {
        if (event.data?.backgroundTask !== undefined) {
          continue;
        }
        const name = event.data?.name ?? "subagent";
        const run = [...list].reverse().find((r) => !r.delivered);
        if (run && run.name === name) {
          run.delivered = true;
          run.result = event.data?.output;
        }
        continue;
      }
    }

    return list;
  }, [events]);

  const anyRunning = delegations.some(
    (delegation) => !delegation.delivered && !dismissed.has(delegation.callId),
  );

  useEffect(() => {
    if (!anyRunning) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [anyRunning]);

  const runs: BackgroundRun[] = delegations
    .filter((delegation) => !dismissed.has(delegation.callId))
    .map((delegation) => {
      const elapsedMs = (now ?? delegation.at) - delegation.at;
      const running = !delegation.delivered;
      const slow = running && elapsedMs > SLOW_REVIEW_S * 1000;
      const label = delegation.name === "editor" ? "Editor review" : `${delegation.name} run`;
      return {
        id: delegation.callId,
        title: label,
        state: delegation.delivered ? ("ready" as const) : ("running" as const),
        elapsed: formatElapsed(elapsedMs),
        summary: running
          ? slow
            ? "long drafts can take a few minutes"
            : "grades coherence, flow, and audience fit"
          : reviewSummary(delegation.result),
      };
    });

  if (runs.length === 0) {
    return null;
  }

  const collect = (id: string) => {
    // The results land in this same thread as the follow-up turn; collecting a
    // run scrolls to the reply and clears the row.
    const thread = document.querySelector("[data-slot=aui_assistant-message-content]");
    thread?.scrollIntoView({ behavior: "smooth", block: "end" });
    setDismissed((prev) => new Set(prev).add(id));
  };

  return (
    <BackgroundInbox
      runs={runs}
      onCollect={collect}
      data-testid="subagent-inbox"
      className="w-full max-w-none"
    />
  );
}
