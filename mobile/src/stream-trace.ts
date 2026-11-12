// Opt-in Metro stream diagnostics. Set EXPO_PUBLIC_STREAM_TRACE=1 in
// mobile/.env.local (dev only) to log timing and lengths — never message text,
// attachment names, credentials, or event payloads.

import {
  createStreamTurnTrace,
  firstDeltaMs,
  firstPaintMs,
  type StreamTurnTrace,
} from "./stream-contract";

export type StreamTraceStage =
  | "send"
  | "delta"
  | "source"
  | "paint"
  | "settled";

let turn: StreamTurnTrace | null = null;
let seq = 0;

function enabled(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_STREAM_TRACE === "1";
}

function now(): number {
  return performance.now();
}

function log(
  stage: StreamTraceStage,
  fields: Record<string, string | number | boolean | null | undefined>,
) {
  if (!enabled()) return;
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`);
  console.info(`[stream-ui] ${stage} ${parts.join(" ")}`);
}

/** Start a new traced turn. Call from prepareSend / onNew. */
export function beginStreamTrace(label = "turn"): string {
  if (!enabled()) return "";
  seq += 1;
  const id = `${label}-${seq}`;
  const startedAt = now();
  turn = createStreamTurnTrace(id, startedAt);
  turn.send(startedAt);
  log("send", { id, t: 0 });
  return id;
}

export function traceStream(
  stage: StreamTraceStage,
  length = 0,
  pending = 0,
): void {
  if (!enabled()) return;
  const t = now();
  const id = turn?.id ?? "idle";
  const sinceSend =
    turn !== null ? Math.round(t - turn.snapshot().startedAt) : Math.round(t);

  if (stage === "send") {
    if (!turn) beginStreamTrace();
    else log("send", { id: turn.id, t: sinceSend });
    return;
  }

  if (!turn) {
    log(stage, { id, t: sinceSend, chars: length, pending });
    return;
  }

  if (stage === "delta") {
    const before = turn.snapshot();
    turn.delta(length, t);
    const after = turn.snapshot();
    log("delta", {
      id,
      t: sinceSend,
      chars: length,
      ...(before.firstDeltaAt === null ? { first: 1, gapMs: null } : { gapMs: after.lastGapMs }),
    });
    return;
  }

  if (stage === "paint") {
    const before = turn.snapshot();
    turn.paint(length, t);
    if (before.firstPaintAt === null) {
      log("paint", {
        id,
        t: sinceSend,
        chars: length,
        pending,
        first: 1,
        sinceFirstDeltaMs:
          before.firstDeltaAt !== null
            ? Math.round(t - before.firstDeltaAt)
            : null,
      });
    } else {
      log("paint", { id, t: sinceSend, chars: length, pending });
    }
    return;
  }

  if (stage === "source") {
    turn.source(length, t);
    log("source", { id, t: sinceSend, chars: length, pending });
    return;
  }

  if (stage === "settled") {
    const snapshot = turn.settled(t);
    log("settled", {
      id,
      t: sinceSend,
      deltas: snapshot.deltaCount,
      chars: snapshot.deltaChars,
      firstDeltaMs: firstDeltaMs(snapshot),
      firstPaintMs: firstPaintMs(snapshot),
      lastGapMs: snapshot.lastGapMs,
    });
    turn = null;
    return;
  }
}
