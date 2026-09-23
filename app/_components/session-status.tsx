"use client";

import { useEffect, useState } from "react";
import { useAui, useAuiState } from "@assistant-ui/react";
import { useEveEvents } from "@assistant-ui/eve";
import { Loader2, X } from "lucide-react";

// Session status banner: makes the eve session's state visible at a glance
// (docs: guides/frontend/overview — status: ready | resuming | submitted |
// streaming | error, and the HITL pending-request contract).
//
// - In-flight turn: "Agent is working" + elapsed seconds + a Stop button
//   (thread.cancel() — eve durably cancels the turn, the session stays safe
//   to continue).
// - Stall watchdog: no stream events for 45s while in flight reads as a
//   warning, so a dead gateway call shows as text instead of an endless
//   spinner.
// - Waiting for you: the newest durable state is an unanswered input request
//   (tool-approval park or ask_question). The request itself renders in the
//   thread via the mapped tool-approval UI; this banner explains that the
//   agent is paused on the user.
//
// Turn failures surface separately through useEveError (EveErrorToast).

const STALL_WARNING_MS = 45_000;

type StreamEvent = {
  readonly type?: string;
  readonly meta?: { readonly at?: string };
  readonly data?: {
    readonly requests?: readonly { callId?: string }[];
    readonly callId?: string;
  };
};

function lastEventTimestamp(events: readonly unknown[]): number | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i] as { meta?: { at?: string } };
    const at = event?.meta?.at;

    if (at) {
      const parsed = Date.parse(at);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

export function SessionStatusBanner({ isRunning }: { readonly isRunning: boolean }) {
  const events = useEveEvents();
  const aui = useAui();
  // Cache Components: the prerendered shell must be deterministic, so wall
  // clock reads are deferred to an effect (docs: blocking-prerender-current-
  // time-client). `now === null` on the server and before hydration; the
  // elapsed ticker and stall watchdog start once the client clock exists.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!isRunning) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  // Derive the phase in one forward pass over the authoritative stream:
  // unanswered input requests (the agent is paused on the user), the
  // in-flight turn's start time, and the newest event timestamp.
  const pendingCalls = new Set<string>();
  let pendingInput = false;
  let workingStartedAt: number | null = null;
  let lastAt: number | null = null;
  let receivedCount = 0;
  let startedCount = 0;
  let lastReceivedAt: number | null = null;

  for (const raw of events) {
    const event = raw as StreamEvent;
    const at = event.meta?.at;

    if (at) {
      const parsed = Date.parse(at);
      if (Number.isFinite(parsed)) lastAt = parsed;
    }

    if (event.type === "input.requested") {
      for (const request of event.data?.requests ?? []) {
        if (request.callId) pendingCalls.add(request.callId);
      }
      pendingInput = pendingCalls.size > 0;
      continue;
    }

    if (event.type === "action.result" && event.data?.callId) {
      pendingCalls.delete(event.data.callId);
      continue;
    }

    if (event.type === "message.received") {
      receivedCount += 1;
      const parsed = Date.parse(event.meta?.at ?? "");
      if (Number.isFinite(parsed)) lastReceivedAt = parsed;
      continue;
    }

    if (event.type === "turn.started") {
      startedCount += 1;
      const parsed = Date.parse(event.meta?.at ?? "");
      if (Number.isFinite(parsed)) workingStartedAt = parsed;
      continue;
    }

    if (
      event.type === "turn.completed" ||
      event.type === "turn.cancelled" ||
      event.type === "turn.failed"
    ) {
      workingStartedAt = null;
      pendingCalls.clear();
    }
  }

  pendingInput = pendingCalls.size > 0;

  // In-flight = the thread reports running (submitted/streaming) and the
  // durable state is not paused on the user. While an assistant message is
  // actually streaming, the in-thread ThinkingIndicator owns the status line
  // (assistant-ui thinking-indicator recipe) and this banner stays out of the
  // way; the banner only covers what the thread cannot show: the gap between
  // submit and the first message (a dead worker shows up here), resuming, and
  // the waiting-for-confirmation state.
  const assistantStreaming = useAuiState((s) => {
    const last = s.thread.messages.at(-1);
    return last?.role === "assistant" && last.status?.type === "running";
  });
  const queued =
    isRunning && !pendingInput && !assistantStreaming && receivedCount > startedCount;
  const working = isRunning && !pendingInput && !assistantStreaming;
  const startedAt = workingStartedAt ?? (working ? now : null);
  const elapsedS =
    startedAt === null || now === null
      ? 0
      : Math.max(0, Math.floor((now - startedAt) / 1000));
  const stalled =
    startedAt !== null && lastAt !== null && now !== null && now - lastAt > STALL_WARNING_MS;

  if (pendingInput) {
    return (
      <div
        data-testid="session-status"
        className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      >
        <span className="font-medium">Waiting for your confirmation.</span> The
        agent is paused on a question or approval above — reply to continue.
      </div>
    );
  }

  if (queued) {
    const queuedElapsed =
      lastReceivedAt === null || now === null
        ? 0
        : Math.max(0, Math.floor((now - lastReceivedAt) / 1000));
    return (
      <div
        data-testid="session-status"
        className="border-border/60 bg-muted/50 px-4 py-2 text-sm text-muted-foreground"
      >
        <span className="font-medium">Queued.</span> Your message runs after
        the current one finishes ({queuedElapsed}s in line) — it is saved and
        will not be lost.
      </div>
    );
  }

  if (!isRunning || assistantStreaming) {
    return null;
  }

  return (
    <div
      data-testid="session-status"
      className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-sm text-muted-foreground"
    >
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      <span>
        {stalled
          ? "The agent has been working a while without updates — the model may be slow or unreachable."
          : `Agent is working${elapsedS > 0 ? ` (${elapsedS}s)` : "…"}`}
      </span>
      <button
        type="button"
        onClick={() => void aui.thread.cancelRun()}
        className="ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-accent"
      >
        <X className="size-3" aria-hidden />
        Stop
      </button>
    </div>
  );
}
