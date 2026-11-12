/**
 * Pure streaming-turn milestones and cadence checks. No React, no console —
 * used by unit tests and by the opt-in Metro logger in stream-trace.ts.
 */

export type StreamTurnSnapshot = {
  readonly id: string;
  readonly startedAt: number;
  readonly firstDeltaAt: number | null;
  readonly lastDeltaAt: number | null;
  readonly firstPaintAt: number | null;
  readonly deltaCount: number;
  readonly deltaChars: number;
  readonly lastGapMs: number | null;
  readonly maxGapMs: number | null;
  readonly deltaSizes: readonly number[];
  readonly gapsMs: readonly number[];
  readonly settledAt: number | null;
};

export type StreamTurnTrace = {
  readonly id: string;
  send(t?: number): void;
  delta(chars: number, t: number): void;
  paint(chars: number, t: number): void;
  source(chars: number, t: number): void;
  settled(t: number): StreamTurnSnapshot;
  snapshot(): StreamTurnSnapshot;
};

type MutableTrace = {
  id: string;
  startedAt: number;
  firstDeltaAt: number | null;
  lastDeltaAt: number | null;
  firstPaintAt: number | null;
  deltaCount: number;
  deltaChars: number;
  lastGapMs: number | null;
  maxGapMs: number | null;
  deltaSizes: number[];
  gapsMs: number[];
  settledAt: number | null;
};

function toSnapshot(state: MutableTrace): StreamTurnSnapshot {
  return {
    id: state.id,
    startedAt: state.startedAt,
    firstDeltaAt: state.firstDeltaAt,
    lastDeltaAt: state.lastDeltaAt,
    firstPaintAt: state.firstPaintAt,
    deltaCount: state.deltaCount,
    deltaChars: state.deltaChars,
    lastGapMs: state.lastGapMs,
    maxGapMs: state.maxGapMs,
    deltaSizes: [...state.deltaSizes],
    gapsMs: [...state.gapsMs],
    settledAt: state.settledAt,
  };
}

/** Create a turn milestone recorder. `startedAt` defaults to 0 for tests. */
export function createStreamTurnTrace(
  id: string,
  startedAt = 0,
): StreamTurnTrace {
  const state: MutableTrace = {
    id,
    startedAt,
    firstDeltaAt: null,
    lastDeltaAt: null,
    firstPaintAt: null,
    deltaCount: 0,
    deltaChars: 0,
    lastGapMs: null,
    maxGapMs: null,
    deltaSizes: [],
    gapsMs: [],
    settledAt: null,
  };

  return {
    id,
    send(t = startedAt) {
      state.startedAt = t;
    },
    delta(chars, t) {
      const size = Math.max(0, chars);
      if (state.firstDeltaAt === null) {
        state.firstDeltaAt = t;
      } else if (state.lastDeltaAt !== null) {
        const gap = Math.max(0, Math.round(t - state.lastDeltaAt));
        state.lastGapMs = gap;
        state.gapsMs.push(gap);
        state.maxGapMs =
          state.maxGapMs === null ? gap : Math.max(state.maxGapMs, gap);
      }
      state.lastDeltaAt = t;
      state.deltaCount += 1;
      state.deltaChars += size;
      state.deltaSizes.push(size);
    },
    paint(_chars, t) {
      if (state.firstPaintAt === null) state.firstPaintAt = t;
    },
    source(_chars, _t) {
      // Source updates are observed for logging only; cadence uses deltas.
    },
    settled(t) {
      state.settledAt = t;
      return toSnapshot(state);
    },
    snapshot() {
      return toSnapshot(state);
    },
  };
}

export function firstDeltaMs(snapshot: StreamTurnSnapshot): number | null {
  if (snapshot.firstDeltaAt === null) return null;
  return Math.round(snapshot.firstDeltaAt - snapshot.startedAt);
}

export function firstPaintMs(snapshot: StreamTurnSnapshot): number | null {
  if (snapshot.firstPaintAt === null) return null;
  return Math.round(snapshot.firstPaintAt - snapshot.startedAt);
}

/** True when any inter-delta gap exceeds maxQuietMs (default 500ms). */
export function isBurstyGaps(
  gapsMs: readonly number[],
  { maxQuietMs = 500 }: { maxQuietMs?: number } = {},
): boolean {
  return gapsMs.some((gap) => gap > maxQuietMs);
}

/**
 * True when deltas arrive as small incremental chunks rather than one dump.
 * A single delta of the full reply is treated as non-incremental.
 */
export function isIncrementalDeltas(
  charSizes: readonly number[],
  {
    maxChunkChars = 64,
    minDeltas = 2,
  }: { maxChunkChars?: number; minDeltas?: number } = {},
): boolean {
  if (charSizes.length < minDeltas) return false;
  return charSizes.every((size) => size > 0 && size <= maxChunkChars);
}

/** Derived metrics used by regression tests and the Metro logger. */
export function streamTurnMetrics(snapshot: StreamTurnSnapshot) {
  return {
    firstDeltaMs: firstDeltaMs(snapshot),
    firstPaintMs: firstPaintMs(snapshot),
    deltas: snapshot.deltaCount,
    chars: snapshot.deltaChars,
    lastGapMs: snapshot.lastGapMs,
    maxGapMs: snapshot.maxGapMs,
    bursty: isBurstyGaps(snapshot.gapsMs),
    incremental: isIncrementalDeltas(snapshot.deltaSizes),
  };
}
