"use client";

import { useEffect, useRef, useState } from "react";

export type ElapsedOptions = {
  /** Freeze the displayed seconds without clearing (HITL / requires-action). */
  readonly paused?: boolean;
  /**
   * Absolute epoch ms for the turn start (first turn-scoped event). When set,
   * elapsed tracks wall time from that anchor so live matches settled duration.
   */
  readonly sinceMs?: number | null;
};

function formatSeconds(ms: number): string {
  return `${Math.max(0, Math.round(ms / 1000))}s`;
}

/**
 * Live elapsed badge for a streaming view. Starts when `active` flips true,
 * clears when it flips false. With `paused`, keeps the last label. With
 * `sinceMs`, measures from that event timestamp instead of mount time.
 */
export function useElapsedLabel(
  active: boolean,
  options: ElapsedOptions = {},
): string | undefined {
  const { paused = false, sinceMs = null } = options;
  const [label, setLabel] = useState<string | undefined>(undefined);
  const fallbackStartRef = useRef<number | null>(null);
  const frozenMsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setLabel(undefined);
      fallbackStartRef.current = null;
      frozenMsRef.current = null;
      return;
    }

    const elapsedMs = (): number => {
      if (frozenMsRef.current !== null && paused) return frozenMsRef.current;
      if (sinceMs != null && Number.isFinite(sinceMs)) {
        return Math.max(0, Date.now() - sinceMs);
      }
      if (fallbackStartRef.current === null) {
        fallbackStartRef.current = Date.now();
      }
      return Math.max(0, Date.now() - fallbackStartRef.current);
    };

    if (paused) {
      frozenMsRef.current = elapsedMs();
      setLabel(formatSeconds(frozenMsRef.current));
      return;
    }

    frozenMsRef.current = null;
    // Prefer event anchor when it arrives mid-turn (drops preparing-only time).
    if (sinceMs != null && Number.isFinite(sinceMs)) {
      fallbackStartRef.current = null;
    } else if (fallbackStartRef.current === null) {
      fallbackStartRef.current = Date.now();
    }

    setLabel(formatSeconds(elapsedMs()));
    const id = setInterval(() => {
      setLabel(formatSeconds(elapsedMs()));
    }, 1000);
    return () => clearInterval(id);
  }, [active, paused, sinceMs]);

  return active ? label ?? "0s" : undefined;
}
