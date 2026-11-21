"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Maps scroll position of `target` through a Motion-style offset pair to 0–1.
 * Offsets use the same vocabulary as Motion `useScroll`: `"start end"`,
 * `"start start"`, `"center 70%"`, `"end ${px}px"`, etc.
 */
export function useScrollProgress(
  target: RefObject<HTMLElement | null>,
  startOffset: string,
  endOffset: string,
  enabled = true,
): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setProgress(1);
      return;
    }

    const node = target.current;
    if (!node) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = resolveEdge(rect, vh, startOffset, "start");
      const end = resolveEdge(rect, vh, endOffset, "end");
      const span = end - start;
      const next =
        span === 0 ? (vh <= start ? 1 : 0) : clamp((0 - start) / span, 0, 1);
      setProgress((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [target, startOffset, endOffset, enabled]);

  return progress;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Distance from viewport top (0) to the named edge pairing. */
function resolveEdge(
  rect: DOMRect,
  vh: number,
  token: string,
  fallbackTarget: "start" | "end",
): number {
  const [targetPart, viewPart] = token.trim().split(/\s+/);
  const targetEdge = parsePart(targetPart ?? fallbackTarget, rect.height);
  const viewEdge = parsePart(viewPart ?? "start", vh);
  return rect.top + targetEdge - viewEdge;
}

function parsePart(part: string, size: number): number {
  if (part === "start") return 0;
  if (part === "center") return size / 2;
  if (part === "end") return size;
  if (part.endsWith("%")) {
    const pct = Number.parseFloat(part);
    return Number.isFinite(pct) ? (size * pct) / 100 : 0;
  }
  if (part.endsWith("px")) {
    const px = Number.parseFloat(part);
    return Number.isFinite(px) ? px : 0;
  }
  return 0;
}

/** Smoothstep (quintic) used by Wajo’s dial fan/turn easing. */
export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}
