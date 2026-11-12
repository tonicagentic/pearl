/** Event shapes we read for turn duration (eve stream + fixtures). */
export type TurnDurationEvent = {
  readonly type?: string;
  readonly data?: { readonly turnId?: unknown };
  readonly meta?: { readonly at?: unknown };
};

const SKIP_TYPES = new Set(["message.received", "delivery.consumed"]);

/**
 * First and last `meta.at` among events for `turnId` (data.turnId), skipping
 * user-side delivery markers. Used for live anchors and settled "Worked for".
 */
export function turnEventSpan(
  events: readonly unknown[],
  turnId: string | undefined,
): { startMs: number; endMs: number } | undefined {
  if (!turnId) return undefined;
  let start: number | undefined;
  let end: number | undefined;
  for (const event of events) {
    const raw = event as TurnDurationEvent;
    if (!raw || typeof raw !== "object") continue;
    if (typeof raw.type === "string" && SKIP_TYPES.has(raw.type)) continue;
    if (raw.data?.turnId !== turnId) continue;
    const at = raw.meta?.at;
    const ts = typeof at === "string" ? Date.parse(at) : NaN;
    if (!Number.isFinite(ts)) continue;
    start ??= ts;
    end = ts;
  }
  if (start === undefined || end === undefined) return undefined;
  return { startMs: start, endMs: end };
}

export function formatDurationMs(ms: number): string {
  return `${Math.max(0, Math.round(ms / 1000))}s`;
}
