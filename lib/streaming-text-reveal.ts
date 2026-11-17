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

/**
 * Survive React remounts during high-frequency delta re-renders. Without this,
 * each remount re-inits shown at `ready - rate` and rAF never finishes the
 * last second of words (cursor-only / single-word stall on mobile).
 *
 * Only the live (`streaming`) instance mutates this. Settled markdown must not
 * reset it during render — user bubbles also call this hook with streaming=false.
 */
let turnShown = 0;
let turnTickAt = 0;
let turnFadeFromWord = 0;
let turnFadeFromChar = 0;

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function resetTurn(): void {
  turnShown = 0;
  turnTickAt = nowMs();
  turnFadeFromWord = 0;
  turnFadeFromChar = 0;
}

function applyCatchUpFloor(ready: number, rate: number, tokens: readonly Token[]): void {
  const floor = ready > rate ? ready - rate : 0;
  turnShown = Math.max(turnShown, floor);
  if (floor > turnFadeFromWord) {
    turnFadeFromWord = floor;
    turnFadeFromChar = tokens[floor]?.start ?? 0;
  }
}

/**
 * Pace words at `wordsPerSecond` while the stream is live (desktop chat feel).
 * Huge mid-stream jumps skip ahead but keep ~1s of tail to animate. When the
 * turn ends, snap the remainder — no theatrical post-complete catch-up.
 *
 * Progress is wall-clock + module-level so remounts / cancelled rAFs cannot
 * pin the UI on a lone cursor while hundreds of words sit buffered.
 */
export function useStreamingReveal(
  text: string,
  streaming: boolean,
  wordsPerSecond: number = DEFAULT_WORDS_PER_SECOND,
): StreamingReveal {
  const tokens = useMemo(() => tokenize(text), [text]);
  // Count the in-progress last token too — holding it back left mobile blank
  // for the whole first-word lead-in. Partial words grow in place via clip.
  const ready = tokens.length;
  const rate = Math.max(wordsPerSecond, 1);

  if (streaming) {
    const t = nowMs();
    if (turnTickAt === 0) {
      applyCatchUpFloor(ready, rate, tokens);
      turnTickAt = t;
    } else {
      const dt = Math.min(0.1, (t - turnTickAt) / 1000);
      turnTickAt = t;
      applyCatchUpFloor(ready, rate, tokens);
      if (turnShown < ready) {
        turnShown = Math.min(ready, turnShown + dt * rate);
      }
    }
  }

  const shownTarget = streaming ? Math.min(ready, Math.floor(turnShown)) : ready;

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
  // Do not reset module progress in the rAF cleanup — remounts would wipe it.
  useEffect(() => {
    if (!streaming) {
      resetTurn();
      return undefined;
    }
    let raf = 0;
    const tick = () => {
      const t = nowMs();
      const dt = Math.min(0.1, (t - turnTickAt) / 1000);
      turnTickAt = t;
      const r = liveReady.current;
      applyCatchUpFloor(r, rate, liveTokens.current);
      if (turnShown < r) {
        turnShown = Math.min(r, turnShown + dt * rate);
      }
      const next = Math.min(r, Math.floor(turnShown));
      if (next !== shownRef.current) {
        shownRef.current = next;
        setShown(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [streaming, rate]);

  const visibleCount = Math.min(shown, ready);
  const lastToken = visibleCount > 0 ? tokens[visibleCount - 1]! : null;
  const revealed = lastToken ? lastToken.end : 0;
  const clip = lastToken
    ? lastToken.start + lastToken.text.trimEnd().length
    : 0;
  const writing = streaming || visibleCount < ready;
  const fadeFrom = streaming ? turnFadeFromChar : text.length;
  const fadeFromWord = streaming ? turnFadeFromWord : ready;

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
  resetTurn();
}
