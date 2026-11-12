import { useEffect, useRef, useState } from "react";

import { traceStream } from "./stream-trace";

/** Cadence for coalescing stream text into React while measuring / probing. */
export const STREAM_PAINT_MS = 40;

/**
 * Receive continuously into a ref; commit to React on a fixed cadence while
 * `streaming` is true. Leading edge paints the first non-empty chunk
 * immediately so TTFT stays visible. When streaming ends, flush the full text.
 */
export function useBatchedStreamText(
  text: string,
  streaming: boolean,
  intervalMs = STREAM_PAINT_MS,
): string {
  const [painted, setPainted] = useState(text);
  const pendingRef = useRef(text);
  const lastFlushRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    pendingRef.current = text;
    if (!streaming) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
      lastFlushRef.current = 0;
      setPainted(text);
      return;
    }

    const flush = (next: string) => {
      lastFlushRef.current = Date.now();
      traceStream("paint", next.length, Math.max(0, text.length - next.length));
      setPainted(next);
    };

    const now = Date.now();
    const elapsed = now - lastFlushRef.current;
    if (lastFlushRef.current === 0 || elapsed >= intervalMs) {
      flush(text);
      return;
    }
    if (timerRef.current !== undefined) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      flush(pendingRef.current);
    }, intervalMs - elapsed);
  }, [text, streaming, intervalMs]);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
    },
    [],
  );

  return painted;
}

/** Concatenate assistant text parts from a projected / eve message content list. */
export function assistantTextFromParts(
  parts: readonly { type: string; text?: string }[] | undefined,
): string {
  if (!parts) return "";
  let out = "";
  for (const part of parts) {
    if (part.type === "text" && typeof part.text === "string") out += part.text;
  }
  return out;
}
