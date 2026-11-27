/**
 * Shared elapsed formatting for task / subagent cards (assistant-ui task-card).
 */

export const TASK_PAGE_SIZE = 4;

/** Format a duration the way assistant-ui's task card does. */
export function formatElapsed(ms: number): string {
  if (ms < 1000) return "<1s";
  const seconds = ms / 1000;
  if (seconds < 10) return `${(Math.floor(seconds * 10) / 10).toFixed(1)}s`;
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

/**
 * Elapsed ms for a run that started at `startedAt`. While live and unsettled,
 * pass the current wall clock; once settled, pass `settledAt` (or freeze at
 * the last live value) so the digit stops ticking.
 */
export function elapsedMsForRun(input: {
  readonly startedAt: number | undefined;
  readonly settledAt?: number | undefined;
  readonly now: number;
  readonly live: boolean;
}): number | undefined {
  const { startedAt, settledAt, now, live } = input;
  if (startedAt === undefined) return undefined;
  if (settledAt !== undefined) return Math.max(0, settledAt - startedAt);
  if (!live) return undefined;
  return Math.max(0, now - startedAt);
}

/**
 * Keep prior run objects when callId + lifecycle fields are unchanged so a
 * coarse clock tick does not force TaskGroup to remount every lane.
 */
export function stabilizeSubagentRuns<
  T extends {
    readonly callId: string;
    readonly name: string;
    readonly at: number;
    readonly state: string;
    readonly delivered: boolean;
    readonly result?: unknown;
  },
>(prev: readonly T[] | undefined, next: readonly T[]): readonly T[] {
  if (!prev || prev.length !== next.length) return next;
  let changed = false;
  const out = next.map((run, index) => {
    const prior = prev[index];
    if (
      prior &&
      prior.callId === run.callId &&
      prior.name === run.name &&
      prior.at === run.at &&
      prior.state === run.state &&
      prior.delivered === run.delivered &&
      prior.result === run.result
    ) {
      return prior;
    }
    changed = true;
    return run;
  });
  return changed ? out : prev;
}
