// Timed TraceWaterfall spans derived from eve event `meta.at` pairs.

import type {
  ThreadTraceEvent,
  ThreadTraceSpan,
  ThreadTraceSpanStatus,
  ThreadTraceTurn,
} from "./thread-trace.ts";

type PendingSpanStart = {
  readonly atMs: number;
  readonly name: string;
  readonly turnId: string | null;
};

type MutableChildSpan = {
  id: string;
  name: string;
  turnId: string | null;
  startAbsMs: number;
  endAbsMs: number | null;
  status: ThreadTraceSpanStatus;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function turnIdOf(event: ThreadTraceEvent): string | null {
  return (
    asString(event.scope?.turnId) ??
    asString(event.data?.turnId) ??
    asString(event.data?.owner?.turnId)
  );
}

function runIdOf(event: ThreadTraceEvent): string | null {
  return (
    asString(event.data?.runId) ??
    asString(event.data?.owner?.runId) ??
    asString(event.scope?.runId)
  );
}

export function eventAtMs(event: ThreadTraceEvent): number | null {
  const raw = event.meta?.at;
  if (typeof raw !== "string" || raw.length === 0) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function turnCostUsd(turn: ThreadTraceTurn): number | null {
  let model: number | null = null;
  let tools = 0;
  for (const call of turn.calls) {
    if (call.costUsd != null) model = (model ?? 0) + call.costUsd;
  }
  for (const tool of turn.tools) tools += tool.costUsd;
  if (model === null && tools <= 0) return null;
  return (model ?? 0) + tools;
}

/**
 * Builds TraceWaterfall spans from event timing.
 * Anchored to the earliest `meta.at`. Incomplete starts stay `running`
 * through `nowMs` (drawer-open live threads).
 */
export function buildThreadTraceSpans(input: {
  readonly events: readonly ThreadTraceEvent[];
  readonly turnLabels: ReadonlyMap<string, string>;
  readonly callTurns: readonly ThreadTraceTurn[];
  readonly nowMs: number;
}): { spans: ThreadTraceSpan[]; totalMs: number } {
  const { events, turnLabels, callTurns, nowMs } = input;
  let anchorMs: number | null = null;
  for (const event of events) {
    const at = eventAtMs(event);
    if (at == null) continue;
    if (anchorMs == null || at < anchorMs) anchorMs = at;
  }
  if (anchorMs == null) {
    return { spans: [], totalMs: 0 };
  }

  const modelStarts = new Map<string, PendingSpanStart>();
  const stepStarts = new Map<string, PendingSpanStart>();
  const callStarts = new Map<string, PendingSpanStart>();
  const turnByRun = new Map<string, string | null>();
  const children: MutableChildSpan[] = [];
  let childSeq = 0;

  const pushChild = (
    name: string,
    turnId: string | null,
    startAbsMs: number,
    endAbsMs: number | null,
    status: ThreadTraceSpanStatus,
  ) => {
    childSeq += 1;
    children.push({
      endAbsMs,
      id: `span-${childSeq}`,
      name,
      startAbsMs,
      status,
      turnId,
    });
  };

  for (const event of events) {
    const turnId = turnIdOf(event);
    const runId = runIdOf(event);
    const at = eventAtMs(event);

    if (event.type === "model.requested" && runId) {
      const ownerTurn = asString(event.data?.owner?.turnId) ?? turnId;
      if (ownerTurn) turnByRun.set(runId, ownerTurn);
      continue;
    }

    if (event.type === "model.started" && runId && at != null) {
      const modelId = asString(event.data?.modelId) ?? "model";
      const ownerTurn = turnByRun.get(runId) ?? turnId;
      if (ownerTurn) turnByRun.set(runId, ownerTurn);
      modelStarts.set(runId, {
        atMs: at,
        name: modelId,
        turnId: ownerTurn,
      });
      continue;
    }

    if (event.type === "step.started" && turnId && at != null) {
      const modelId = asString(event.data?.modelId) ?? "model";
      const stepIndex = asNumber(event.data?.stepIndex);
      const key =
        stepIndex !== null ? `${turnId}::${stepIndex}` : `${turnId}::anon`;
      stepStarts.set(key, { atMs: at, name: modelId, turnId });
      continue;
    }

    if (event.type === "call.requested" && at != null) {
      const callId = asString(event.data?.callId);
      const name =
        asString(event.data?.capability?.name) ??
        asString(event.data?.name) ??
        "tool";
      if (!callId) continue;
      const ownerTurn =
        asString(event.data?.owner?.turnId) ??
        turnId ??
        (runId ? (turnByRun.get(runId) ?? null) : null);
      callStarts.set(callId, { atMs: at, name, turnId: ownerTurn });
      continue;
    }

    if (event.type === "usage.recorded" && at != null) {
      const kind = asString(event.data?.kind);
      if (kind === "delegated-late") continue;
      if (
        asString(event.data?.owner?.callId) &&
        !asString(event.data?.owner?.runId)
      ) {
        continue;
      }
      const start = runId ? modelStarts.get(runId) : undefined;
      if (runId) modelStarts.delete(runId);
      const resolvedTurn =
        start?.turnId ??
        turnId ??
        (runId ? (turnByRun.get(runId) ?? null) : null);
      pushChild(start?.name ?? "model", resolvedTurn, start?.atMs ?? at, at, "completed");
      continue;
    }

    if (event.type === "step.completed" && at != null && turnId) {
      const stepIndex = asNumber(event.data?.stepIndex);
      const key =
        stepIndex !== null ? `${turnId}::${stepIndex}` : `${turnId}::anon`;
      const start = stepStarts.get(key) ?? stepStarts.get(`${turnId}::anon`);
      if (start) {
        stepStarts.delete(key);
        stepStarts.delete(`${turnId}::anon`);
      }
      pushChild(
        start?.name ?? "model",
        turnId,
        start?.atMs ?? at,
        at,
        "completed",
      );
      continue;
    }

    if (event.type === "call.settled" && at != null) {
      const callId = asString(event.data?.callId);
      const start = callId ? callStarts.get(callId) : undefined;
      if (callId) callStarts.delete(callId);
      if (!start) continue;
      const outcome = asString(event.data?.outcome);
      const status: ThreadTraceSpanStatus =
        outcome && outcome !== "completed" ? "failed" : "completed";
      pushChild(start.name, start.turnId, start.atMs, at, status);
    }
  }

  for (const start of modelStarts.values()) {
    pushChild(start.name, start.turnId, start.atMs, null, "running");
  }
  for (const start of stepStarts.values()) {
    pushChild(start.name, start.turnId, start.atMs, null, "running");
  }
  for (const start of callStarts.values()) {
    pushChild(start.name, start.turnId, start.atMs, null, "running");
  }

  if (children.length === 0 && callTurns.length === 0) {
    return { spans: [], totalMs: 0 };
  }

  const turnOrder: string[] = [];
  const seenTurns = new Set<string>();
  for (const turn of callTurns) {
    const key = turn.turnId ?? `__anon-${turnOrder.length}`;
    if (!seenTurns.has(key)) {
      seenTurns.add(key);
      turnOrder.push(key);
    }
  }
  for (const child of children) {
    const key = child.turnId ?? "__orphan";
    if (!seenTurns.has(key)) {
      seenTurns.add(key);
      turnOrder.push(key);
    }
  }
  if (turnOrder.length === 0) turnOrder.push("__thread");

  const spans: ThreadTraceSpan[] = [];
  let maxEnd = 0;

  for (const turnKey of turnOrder) {
    const turnChildren = children.filter((child) => {
      if (turnKey.startsWith("__anon-") || turnKey === "__orphan") {
        return child.turnId == null;
      }
      if (turnKey === "__thread") return true;
      return child.turnId === turnKey;
    });

    let turnStartAbs = Number.POSITIVE_INFINITY;
    let turnEndAbs = 0;
    for (const child of turnChildren) {
      turnStartAbs = Math.min(turnStartAbs, child.startAbsMs);
      turnEndAbs = Math.max(turnEndAbs, child.endAbsMs ?? nowMs);
    }
    if (!Number.isFinite(turnStartAbs)) {
      turnStartAbs = anchorMs;
      turnEndAbs = anchorMs;
    }

    const turnId = turnKey.startsWith("__") ? null : turnKey;
    const label =
      (turnId ? turnLabels.get(turnId) : null) ??
      (turnId
        ? (callTurns.find((t) => t.turnId === turnId)?.label ?? turnId)
        : "Thread");

    const turnStartMs = Math.max(0, turnStartAbs - anchorMs);
    const turnDuration = Math.max(0, turnEndAbs - turnStartAbs);
    maxEnd = Math.max(maxEnd, turnStartMs + turnDuration);

    spans.push({
      depth: 0,
      durationMs: turnDuration,
      id: `turn-${turnKey}`,
      name: label,
      startMs: turnStartMs,
      status: turnChildren.some((c) => c.status === "running")
        ? "running"
        : turnChildren.some((c) => c.status === "failed")
          ? "failed"
          : "completed",
    });

    for (const child of turnChildren) {
      const end = child.endAbsMs ?? nowMs;
      const startMs = Math.max(0, child.startAbsMs - anchorMs);
      const durationMs = Math.max(0, end - child.startAbsMs);
      maxEnd = Math.max(maxEnd, startMs + durationMs);
      spans.push({
        depth: 1,
        durationMs,
        id: child.id,
        name: child.name,
        startMs,
        status: child.status,
      });
    }
  }

  return { spans, totalMs: Math.max(maxEnd, 1) };
}
