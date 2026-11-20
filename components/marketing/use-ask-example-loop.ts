"use client";

import { useEffect, useRef, useState, type FocusEvent } from "react";
import { ASK_EXAMPLES } from "@/components/marketing/ask-examples";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";

const ROTATE_MS = 12000;
const RESUME_IDLE_MS = 8000;

/**
 * Rotates Ask Pearl examples with pause on hover/focus/manual select.
 * When `rotate` is false (SSR static frame or reduced motion), index stays
 * put unless the user picks a tab.
 */
export function useAskExampleLoop({
  rotate = true,
}: {
  readonly rotate?: boolean;
} = {}) {
  const reduceMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = ASK_EXAMPLES[index] ?? ASK_EXAMPLES[0];
  const paused = hoverPaused || focusPaused || manualPaused;
  const shouldRotate = rotate && !reduceMotion && !paused;

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!shouldRotate) return;
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % ASK_EXAMPLES.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [shouldRotate]);

  const pauseForInteraction = () => {
    setManualPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      resumeTimer.current = null;
      setManualPaused(false);
    }, RESUME_IDLE_MS);
  };

  const select = (next: number) => {
    setIndex(next);
    pauseForInteraction();
  };

  return {
    index,
    active,
    reduceMotion,
    select,
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
