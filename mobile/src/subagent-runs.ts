// Derive the background-run list from the eve subagent event stream
// (consumed by the background inbox UI). Pure and deterministic given `now`
// so the failure states are testable.
//
// Event lifecycle (from eve harness/emission.js + observed chat_event rows):
// - `subagent.called` — the delegation; carries name, callId, childSessionId.
// - `subagent.completed` WITH `backgroundTask` — the tool call returning its
//   "working" receipt; the run is admitted but not done.
// - `subagent.completed` WITHOUT `backgroundTask` (with `output`) — the child
//   finished; `output` is the child's structured result.
//
// Failure state: eve dev cancels live tasks when the parent session finalizes
// (e.g. a dev-server restart), which leaves a receipt with no completion in
// the log. A run with no completion after STALE_REVIEW_S is reported as
// "failed" so it does not show as running forever; a late completion event
// still flips it back to ready.

export type SubagentRunState = "running" | "ready" | "failed";

export type SubagentRun = {
  readonly callId: string;
  readonly name: string;
  readonly at: number;
  readonly state: SubagentRunState;
  /** False while the child run has not delivered its final output. */
  readonly delivered: boolean;
  readonly result?: unknown;
};

export const SLOW_REVIEW_S = 180;
export const STALE_REVIEW_S = 1800;

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

type MutableRun = {
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

export function deriveSubagentRuns(
  events: readonly unknown[],
  now: number,
): SubagentRun[] {
  const list: MutableRun[] = [];

  for (const raw of events) {
    const event = raw as StreamEvent;

    // Run starts: either shape — the child-started event, or the tool call
    // returning its working receipt. Deduped by callId (both carry it).
    const isCallStart =
      event.type === "subagent.called" ||
      (event.type === "subagent.completed" &&
        event.data?.backgroundTask?.status === "working");

    if (isCallStart) {
      const callId = event.data?.callId;
      if (callId && list.some((run) => run.callId === callId)) {
        continue;
      }
      const at = eventTime(event);
      list.push({
        callId: callId ?? `run-${list.length}`,
        name: event.data?.name ?? event.data?.subagentName ?? "subagent",
        at,
        delivered: false,
      });
      continue;
    }

    // Final completion: no backgroundTask, carries the child's output.
    if (event.type === "subagent.completed") {
      const name = event.data?.name ?? event.data?.subagentName;
      const run = [...list].reverse().find((r) => !r.delivered && r.name === name);
      if (run) {
        run.delivered = true;
        run.result = event.data?.output;
      }
    }
  }

  return list.map((run) => {
    const stale = !run.delivered && now - run.at > STALE_REVIEW_S * 1000;
    return {
      callId: run.callId,
      name: run.name,
      at: run.at,
      delivered: run.delivered,
      result: run.result,
      state: run.delivered ? ("ready" as const) : stale ? ("failed" as const) : ("running" as const),
    };
  });
}
