// Derive the background-run list from the eve subagent event stream
// (consumed by the background inbox UI). Pure and deterministic given `now`
// so the failure states are testable.
//
// Event lifecycle:
// Legacy (still observed in older chat_event rows):
// - `subagent.called` — the delegation; carries name, callId, childSessionId.
// - `subagent.completed` WITH `backgroundTask` — the tool call returning its
//   "working" receipt; the run is admitted but not done.
// - `subagent.completed` WITHOUT `backgroundTask` (with `output`) — the child
//   finished; `output` is the child's structured result.
//
// v27:
// - `task.started` — background task admitted (`startedBy.callId`, `taskId`, `name`).
// - `child.opened` — child session attached (`owner.callId|taskId`, `name`).
// - `task.ended` — task finished (`taskId`, `outcome`).
// - `call.settled` — parent tool call settled; may carry final output when the
//   background receipt was already shown via task.started.
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
    readonly taskId?: string;
    readonly output?: unknown;
    readonly outcome?: string;
    readonly backgroundTask?: { readonly status?: string; readonly taskId?: string };
    readonly startedBy?: { readonly callId?: string };
    readonly owner?: { readonly callId?: string; readonly taskId?: string };
  };
};

type MutableRun = {
  callId: string;
  taskId?: string;
  name: string;
  at: number;
  delivered: boolean;
  result?: unknown;
};

function eventTime(event: StreamEvent): number {
  const at = event.meta?.at ? Date.parse(event.meta.at) : NaN;
  return Number.isFinite(at) ? at : 0;
}

function findRun(
  list: MutableRun[],
  match: { callId?: string; taskId?: string; name?: string },
): MutableRun | undefined {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const run = list[i]!;
    if (match.callId && run.callId === match.callId) return run;
    if (match.taskId && run.taskId === match.taskId) return run;
  }
  if (match.name) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const run = list[i]!;
      if (!run.delivered && run.name === match.name) return run;
    }
  }
  return undefined;
}

function startRun(
  list: MutableRun[],
  seenCallIds: Set<string>,
  event: StreamEvent,
  fields: { callId?: string; taskId?: string; name?: string },
): void {
  const callId = fields.callId;
  if (callId && seenCallIds.has(callId)) {
    const existing = findRun(list, { callId });
    if (existing) {
      if (fields.taskId && !existing.taskId) existing.taskId = fields.taskId;
      if (fields.name) existing.name = fields.name;
    }
    return;
  }
  if (fields.taskId) {
    const existing = findRun(list, { taskId: fields.taskId });
    if (existing) {
      if (fields.name) existing.name = fields.name;
      if (callId && existing.callId.startsWith("run-")) existing.callId = callId;
      return;
    }
  }
  if (callId) seenCallIds.add(callId);
  list.push({
    callId: callId ?? `run-${list.length}`,
    taskId: fields.taskId,
    name: fields.name ?? event.data?.name ?? event.data?.subagentName ?? "subagent",
    at: eventTime(event),
    delivered: false,
  });
}

export function deriveSubagentRuns(
  events: readonly unknown[],
  now: number,
): SubagentRun[] {
  const list: MutableRun[] = [];
  const seenCallIds = new Set<string>();

  for (const raw of events) {
    const event = raw as StreamEvent;

    const isLegacyStart =
      event.type === "subagent.called" ||
      (event.type === "subagent.completed" &&
        event.data?.backgroundTask?.status === "working");

    if (isLegacyStart) {
      startRun(list, seenCallIds, event, {
        callId: event.data?.callId,
        taskId: event.data?.backgroundTask?.taskId,
        name: event.data?.name ?? event.data?.subagentName,
      });
      continue;
    }

    if (event.type === "task.started") {
      startRun(list, seenCallIds, event, {
        callId: event.data?.startedBy?.callId,
        taskId: event.data?.taskId,
        name: event.data?.name,
      });
      continue;
    }

    if (event.type === "child.opened") {
      startRun(list, seenCallIds, event, {
        callId: event.data?.owner?.callId,
        taskId: event.data?.owner?.taskId ?? event.data?.taskId,
        name: event.data?.name,
      });
      continue;
    }

    if (event.type === "subagent.completed") {
      const name = event.data?.name ?? event.data?.subagentName;
      const run = findRun(list, {
        callId: event.data?.callId,
        name,
      });
      if (run) {
        run.delivered = true;
        run.result = event.data?.output;
      }
      continue;
    }

    if (event.type === "task.ended") {
      const run = findRun(list, {
        taskId: event.data?.taskId,
        callId: event.data?.callId,
        name: event.data?.name,
      });
      if (run) {
        run.delivered = true;
        run.result = {
          outcome: event.data?.outcome,
          ...(event.data?.output !== undefined
            ? { output: event.data.output }
            : {}),
        };
      }
      continue;
    }

    if (event.type === "call.settled") {
      const run = findRun(list, { callId: event.data?.callId });
      if (run && !run.delivered && event.data?.output !== undefined) {
        const output = event.data.output as
          | { backgroundTask?: { status?: string }; status?: string }
          | undefined;
        const working =
          output?.backgroundTask?.status === "working" ||
          output?.status === "working";
        if (!working) {
          run.delivered = true;
          run.result = event.data.output;
        }
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
      state: run.delivered
        ? ("ready" as const)
        : stale
          ? ("failed" as const)
          : ("running" as const),
    };
  });
}
