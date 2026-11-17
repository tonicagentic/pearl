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
  readonly tokens: readonly Token[];
  readonly visibleCount: number;
};

/**
 * Pace buffered words at `wordsPerSecond`, catching up faster when more than
 * ~2s of text is waiting. Complete-on-mount replies show at once.
 */
export function useStreamingReveal(
  text: string,
  streaming: boolean,
  wordsPerSecond: number = DEFAULT_WORDS_PER_SECOND,
): StreamingReveal {
  const tokens = useMemo(() => tokenize(text), [text]);
  // While streaming, the last token may be cut mid-word until whitespace follows.
  const ready =
    streaming && tokens.length > 0 && !/\s$/.test(text)
      ? tokens.length - 1
      : tokens.length;

  const [shown, setShown] = useState(() => (streaming ? 0 : ready));
  const [fadeFrom] = useState(() => (streaming ? 0 : text.length));
  const shownRef = useRef(shown);
  const carryRef = useRef(0);
  const live = useRef({ ready, wordsPerSecond, streaming });

  useEffect(() => {
    live.current = { ready, wordsPerSecond, streaming };
  });

  useEffect(() => {
    let raf = 0;
    let last =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const target = live.current.ready;
      const n = Math.min(shownRef.current, target);
      const behind = target - n;
      if (behind <= 0) {
        shownRef.current = n;
        carryRef.current = 0;
        // Stay scheduled while the turn is live so the next token can resume
        // without waiting for a ready-dep remount of this effect.
        if (live.current.streaming) {
          raf = requestAnimationFrame(tick);
        }
        return;
      }
      carryRef.current += dt * Math.max(live.current.wordsPerSecond, behind / 2);
      const step = Math.min(behind, Math.floor(carryRef.current));
      carryRef.current -= step;
      if (step > 0) {
        shownRef.current = n + step;
        setShown(n + step);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, streaming]);

  // If the stream finishes with a backlog, keep the loop alive via ready bumps;
  // also snap forward when not streaming and we somehow lag (e.g. fast mount).
  useEffect(() => {
    if (streaming) return;
    if (shownRef.current < ready) {
      shownRef.current = ready;
      setShown(ready);
      carryRef.current = 0;
    }
  }, [streaming, ready]);

  const visibleCount = Math.min(shown, ready);
  const lastToken = visibleCount > 0 ? tokens[visibleCount - 1]! : null;
  const revealed = lastToken ? lastToken.end : 0;
  const clip = lastToken
    ? lastToken.start + lastToken.text.trimEnd().length
    : 0;
  const writing = streaming || visibleCount < ready;

  return {
    visibleText: text.slice(0, revealed),
    revealed,
    clip,
    writing,
    fadeFrom,
    tokens,
    visibleCount,
  };
}
