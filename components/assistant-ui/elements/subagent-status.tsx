"use client";

import { useEffect, useState } from "react";
import { useEveEvents } from "@assistant-ui/eve";
import { Loader2 } from "lucide-react";

// Subagent delegation visibility (docs: subagents — declared subagents run as
// durable background tasks: the parent's turn ends immediately with a working
// receipt, and the results arrive later in a follow-up turn). The thread
// otherwise hides that in-between state entirely, which reads as the main
// thread not waiting. This surfaces it: the persisted receipt event marks a
// pending review, and a turn starting after the receipt means the results are
// being delivered.

const SLOW_REVIEW_S = 180;

type StreamEvent = {
  readonly type?: string;
  readonly meta?: { readonly at?: string };
  readonly data?: {
    readonly subagentName?: string;
    readonly backgroundTask?: { readonly status?: string };
  };
};

function eventTime(event: StreamEvent): number {
  const at = event.meta?.at ? Date.parse(event.meta.at) : NaN;
  return Number.isFinite(at) ? at : 0;
}

export function SubagentStatus() {
  const events = useEveEvents();
  // Cache Components: wall-clock reads defer to an effect, same as the
  // session-status banner (docs: blocking-prerender-current-time-client).
  const [now, setNow] = useState<number | null>(null);

  // One forward pass: the latest delegation receipt, and whether any turn
  // started after it (the delivery turn).
  let receipt: { name: string; at: number } | null = null;
  let delivered = false;

  for (const raw of events) {
    const event = raw as StreamEvent;

    if (event.type === "subagent.completed") {
      const status = event.data?.backgroundTask?.status;
      if (status && status !== "working") {
        continue;
      }
      const at = eventTime(event);
      if (at >= (receipt?.at ?? 0)) {
        receipt = { name: event.data?.subagentName ?? "editor", at };
        delivered = false;
      }
      continue;
    }

    if (event.type === "turn.started" && receipt) {
      if (eventTime(event) > receipt.at) {
        delivered = true;
      }
    }
  }

  const pending = receipt !== null && !delivered;

  useEffect(() => {
    if (!pending) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  if (!pending || receipt === null) {
    return null;
  }

  const elapsedS =
    now === null ? 0 : Math.max(0, Math.floor((now - receipt.at) / 1000));
  const slow = elapsedS > SLOW_REVIEW_S;
  const label =
    receipt.name === "editor" ? "Editor is reviewing the draft" : `${receipt.name} is working`;

  return (
    <div
      data-testid="subagent-status"
      className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-sm text-muted-foreground"
    >
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      <span>
        {slow
          ? `${label} — long drafts can take a few minutes (${elapsedS}s elapsed).`
          : `${label} (${elapsedS}s) — the results will land here when it finishes.`}
      </span>
    </div>
  );
}
