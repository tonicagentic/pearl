"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
} from "react";
import { ASK_EXAMPLES } from "@/components/marketing/ask-examples";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";

export const ASK_ROTATE_MS = 12000;

/**
 * Rotates Ask Pearl examples with progress, play/pause, and hover/focus pause.
 * When `rotate` is false (SSR static frame), index stays put unless the user
 * picks a tab; play is forced off.
 */
export function useAskExampleLoop({
  rotate = true,
}: {
  readonly rotate?: boolean;
} = {}) {
  const reduceMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(rotate);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const progressRef = useRef(0);
  const active = ASK_EXAMPLES[index] ?? ASK_EXAMPLES[0];
  const canAutoplay = rotate && !reduceMotion;
  const advancing =
    canAutoplay && playing && !hoverPaused && !focusPaused;

  useEffect(() => {
    if (!rotate || reduceMotion) {
      setPlaying(false);
    }
  }, [reduceMotion, rotate]);

  useEffect(() => {
    if (!advancing) return;

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      const next = Math.min(1, progressRef.current + delta / ASK_ROTATE_MS);
      progressRef.current = next;
      setProgress(next);

      if (next >= 1) {
        progressRef.current = 0;
        setProgress(0);
        setIndex((current) => (current + 1) % ASK_EXAMPLES.length);
        last = performance.now();
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [advancing, index]);

  const select = useCallback((next: number) => {
    progressRef.current = 0;
    setProgress(0);
    setIndex(next);
  }, []);

  const togglePlaying = useCallback(() => {
    if (!canAutoplay) return;
    setPlaying((current) => !current);
  }, [canAutoplay]);

  return {
    index,
    active,
    progress,
    /** User play toggle (true even while hover/focus temporarily freezes progress). */
    userPlaying: playing && canAutoplay,
    canAutoplay,
    reduceMotion,
    select,
    togglePlaying,
    pauseBind: {
      onMouseEnter: () => setHoverPaused(true),
      onMouseLeave: () => setHoverPaused(false),
      onFocus: () => setFocusPaused(true),
      onBlur: (event: FocusEvent<HTMLElement>) => {
        if (
          !event.currentTarget.contains(event.relatedTarget as Node | null)
        ) {
          setFocusPaused(false);
        }
      },
    },
  } as const;
}
