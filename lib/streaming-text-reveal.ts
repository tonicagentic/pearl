import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Tokenizer + smoother from
 * https://www.gregbparker.com/artifacts/streaming-text
 * (defaults: fade reveal, 20 words/sec). Shared by StreamingText and the
 * chat markdown adapters so history mounts show at once while live replies
 * pace evenly.
 */

export type Token = { text: string; start: number; end: number };

/** Whole words with their trailing whitespace, each with its source range. */
export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const re = /\S+\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

export const DEFAULT_WORDS_PER_SECOND = 20;

/** Fallback key when callers omit a per-part id (legacy single-slot behavior). */
const DEFAULT_REVEAL_KEY = "__default__";

export type StreamingReveal = {
  /** Prefix of `text` ending on a word boundary. */
  readonly visibleText: string;
  /** Characters shown (end of last visible token). */
  readonly revealed: number;
  /** Last shown word end without trailing space (cursor sits against it). */
  readonly clip: number;
  /** Words still buffered or stream still open. */
  readonly writing: boolean;
  /** Character offset — words starting before this were present at mount. */
  readonly fadeFrom: number;
  /** Word index — only tokens at/after this get st-fade (catch-up floor). */
  readonly fadeFromWord: number;
  readonly tokens: readonly Token[];
  readonly visibleCount: number;
};

type RevealProgress = {
  shown: number;
  tickAt: number;
  fadeFromWord: number;
  fadeFromChar: number;
};

/**
 * Survive React remounts during high-frequency delta re-renders. Without this,
 * each remount re-inits shown at `ready - rate` and rAF never finishes the
 * last second of words (cursor-only / single-word stall on mobile).
 *
 * Progress is keyed by message/part so concurrent streaming trees do not share
 * or reset each other's cursor. Settled markdown must not reset during render.
 */
const progressByKey = new Map<string, RevealProgress>();

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function resolveKey(key?: string | null): string {
  return key && key.length > 0 ? key : DEFAULT_REVEAL_KEY;
}

function getProgress(key: string): RevealProgress {
  let progress = progressByKey.get(key);
  if (!progress) {
    progress = {
      shown: 0,
      tickAt: nowMs(),
      fadeFromWord: 0,
      fadeFromChar: 0,
    };
    progressByKey.set(key, progress);
  }
  return progress;
}

function resetTurn(key: string): void {
  const progress = getProgress(key);
  progress.shown = 0;
  progress.tickAt = nowMs();
  progress.fadeFromWord = 0;
  progress.fadeFromChar = 0;
}

function snapProgress(progress: RevealProgress): void {
  progress.tickAt = 0;
  progress.shown = 0;
  progress.fadeFromWord = 0;
  progress.fadeFromChar = 0;
}

/**
 * Force the next streaming paint to show whatever is already buffered with
 * no fade. Used after catch-up seeds the live overlay so held text snaps in
 * and only tokens that arrive afterward are paced.
 *
 * Omit `key` (catch-up / legacy) to snap every slot — the message/part id is
 * not known yet, and only the active chat paints. Pass a key to snap one part.
 */
export function snapStreamingReveal(key?: string | null): void {
  if (key == null || key.length === 0) {
    if (progressByKey.size === 0) {
      snapProgress(getProgress(DEFAULT_REVEAL_KEY));
      return;
    }
    for (const progress of progressByKey.values()) {
      snapProgress(progress);
    }
    return;
  }
  snapProgress(getProgress(resolveKey(key)));
}

function applyCatchUpFloor(
  progress: RevealProgress,
  ready: number,
  rate: number,
  tokens: readonly Token[],
): void {
  const floor = ready > rate ? ready - rate : 0;
  progress.shown = Math.max(progress.shown, floor);
  if (floor > progress.fadeFromWord) {
    progress.fadeFromWord = floor;
    progress.fadeFromChar = tokens[floor]?.start ?? 0;
  }
}

/**
 * Advance reveal progress for a streaming turn (keyed so concurrent parts
 * stay isolated). Exported for catch-up tests — the hook calls this on each
 * render/rAF tick.
 */
export function advanceStreamingReveal(
  tokens: readonly Token[],
  wordsPerSecond: number = DEFAULT_WORDS_PER_SECOND,
  now: number = nowMs(),
  key?: string | null,
): {
  readonly shown: number;
  readonly fadeFromWord: number;
  readonly fadeFromChar: number;
} {
  const progress = getProgress(resolveKey(key));
  const ready = tokens.length;
  const rate = Math.max(wordsPerSecond, 1);
  if (progress.tickAt === 0) {
    progress.shown = ready;
    progress.fadeFromWord = ready;
    progress.fadeFromChar = ready > 0 ? (tokens[ready - 1]?.end ?? 0) : 0;
    progress.tickAt = now;
  } else {
    const dt = Math.min(0.1, (now - progress.tickAt) / 1000);
    progress.tickAt = now;
    const before = Math.floor(progress.shown);
    applyCatchUpFloor(progress, ready, rate, tokens);
    const afterFloor = Math.floor(progress.shown);
    if (ready > before && afterFloor <= before) {
      progress.fadeFromWord = before;
      progress.fadeFromChar =
        before > 0 ? (tokens[before - 1]?.end ?? progress.fadeFromChar) : 0;
    }
    if (progress.shown < ready) {
      progress.shown = Math.min(ready, progress.shown + dt * rate);
    }
  }
  return {
    shown: Math.min(ready, Math.floor(progress.shown)),
    fadeFromWord: progress.fadeFromWord,
    fadeFromChar: progress.fadeFromChar,
  };
}

/**
 * Pace words at `wordsPerSecond` while the stream is live (desktop chat feel).
 * Huge mid-stream jumps skip ahead but keep ~1s of tail to animate. When the
 * turn ends, snap the remainder — no theatrical post-complete catch-up.
 *
 * Progress is wall-clock + keyed module state so remounts / cancelled rAFs
 * cannot pin the UI on a lone cursor while hundreds of words sit buffered,
 * and concurrent parts do not share one cursor.
 */
export function useStreamingReveal(
  text: string,
  streaming: boolean,
  wordsPerSecond: number = DEFAULT_WORDS_PER_SECOND,
  key?: string | null,
): StreamingReveal {
  const revealKey = resolveKey(key);
  const tokens = useMemo(() => tokenize(text), [text]);
  // Count the in-progress last token too — holding it back left mobile blank
  // for the whole first-word lead-in. Partial words grow in place via clip.
  const ready = tokens.length;
  const rate = Math.max(wordsPerSecond, 1);
  const progress = getProgress(revealKey);

  if (streaming) {
    advanceStreamingReveal(tokens, rate, nowMs(), revealKey);
  }

  const shownTarget = streaming
    ? Math.min(ready, Math.floor(progress.shown))
    : ready;

  const [shown, setShown] = useState(shownTarget);
  const shownRef = useRef(shown);
  const liveReady = useRef(ready);
  const liveTokens = useRef(tokens);
  liveReady.current = ready;
  liveTokens.current = tokens;

  // Keep React state in lockstep with module progress (drives re-renders).
  if (shown !== shownTarget) {
    shownRef.current = shownTarget;
    setShown(shownTarget);
  }

  // rAF pump while streaming so the last ~1s keeps ticking without new deltas.
  // Remount mid-stream must keep module progress (cancel rAF only). Leaving
  // streaming entirely — or unmounting the live turn — resets so the next
  // thread open first-paints with a snap instead of continuing the old pace.
  useEffect(() => {
    if (!streaming) {
      resetTurn(revealKey);
      return undefined;
    }
    let raf = 0;
    let active = true;
    const tick = () => {
      if (!active) return;
      const slot = getProgress(revealKey);
      const t = nowMs();
      const dt = Math.min(0.1, (t - slot.tickAt) / 1000);
      slot.tickAt = t;
      const r = liveReady.current;
      applyCatchUpFloor(slot, r, rate, liveTokens.current);
      if (slot.shown < r) {
        slot.shown = Math.min(r, slot.shown + dt * rate);
      }
      const next = Math.min(r, Math.floor(slot.shown));
      if (next !== shownRef.current) {
        shownRef.current = next;
        setShown(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(raf);
    };
  }, [streaming, rate, revealKey]);

  const visibleCount = Math.min(shown, ready);
  const lastToken = visibleCount > 0 ? tokens[visibleCount - 1]! : null;
  const revealed = lastToken ? lastToken.end : 0;
  const clip = lastToken
    ? lastToken.start + lastToken.text.trimEnd().length
    : 0;
  const writing = streaming || visibleCount < ready;
  const fadeFrom = streaming ? progress.fadeFromChar : text.length;
  const fadeFromWord = streaming ? progress.fadeFromWord : ready;

  return {
    visibleText: text.slice(0, revealed),
    revealed,
    clip,
    writing,
    fadeFrom,
    fadeFromWord,
    tokens,
    visibleCount,
  };
}

/** Test helper — clear cross-turn module progress. */
export function __resetStreamingRevealForTests(): void {
  progressByKey.clear();
}
