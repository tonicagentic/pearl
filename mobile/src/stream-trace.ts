// Opt-in, development-only stream diagnostics. Log timing and lengths, never
// message text, attachment names, credentials, or event payloads.

export type StreamTraceStage =
  | "send"
  | "delta"
  | "source"
  | "paint"
  | "settled";

type TurnTrace = {
  id: string;
  startedAt: number;
  firstDeltaAt: number | null;
  lastDeltaAt: number | null;
  deltaCount: number;
  deltaChars: number;
  firstPaintAt: number | null;
  lastGapMs: number | null;
};

let turn: TurnTrace | null = null;
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
  turn = {
    id,
    startedAt: now(),
    firstDeltaAt: null,
    lastDeltaAt: null,
    deltaCount: 0,
    deltaChars: 0,
    firstPaintAt: null,
    lastGapMs: null,
  };
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
    turn !== null ? Math.round(t - turn.startedAt) : Math.round(t);

  if (stage === "send") {
    if (!turn) beginStreamTrace();
    else log("send", { id: turn.id, t: sinceSend });
    return;
  }

  if (stage === "delta" && turn) {
    const gap =
      turn.lastDeltaAt !== null ? Math.round(t - turn.lastDeltaAt) : null;
    if (turn.firstDeltaAt === null) {
      turn.firstDeltaAt = t;
      log("delta", {
        id,
        t: sinceSend,
        chars: length,
        first: 1,
        gapMs: null,
      });
    } else {
      log("delta", {
        id,
        t: sinceSend,
        chars: length,
        gapMs: gap,
      });
    }
    turn.lastDeltaAt = t;
    turn.lastGapMs = gap;
    turn.deltaCount += 1;
    turn.deltaChars += length;
    return;
  }

  if (stage === "paint" && turn && turn.firstPaintAt === null) {
    turn.firstPaintAt = t;
    log("paint", {
      id,
      t: sinceSend,
      chars: length,
      pending,
      first: 1,
      sinceFirstDeltaMs:
        turn.firstDeltaAt !== null
          ? Math.round(t - turn.firstDeltaAt)
          : null,
    });
    return;
  }

  if (stage === "settled" && turn) {
    log("settled", {
      id,
      t: sinceSend,
      deltas: turn.deltaCount,
      chars: turn.deltaChars,
      firstDeltaMs:
        turn.firstDeltaAt !== null
          ? Math.round(turn.firstDeltaAt - turn.startedAt)
          : null,
      firstPaintMs:
        turn.firstPaintAt !== null
          ? Math.round(turn.firstPaintAt - turn.startedAt)
          : null,
      lastGapMs: turn.lastGapMs,
    });
    turn = null;
    return;
  }

  log(stage, { id, t: sinceSend, chars: length, pending });
}

/** True when the raw plain-text stream probe overlay should mount. */
export function isStreamProbeEnabled(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_STREAM_PROBE === "1";
}
