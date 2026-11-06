// Per-thread cost breakdown from the live eve event log.
//
// Same source as Settings → Usage (`step.completed` with `data.usage`, model
// from `step.started`), but scoped to one chat's in-memory events so the
// open thread can show totals and a call-by-call trace without a DB round-trip.

import {
  aggregateUsage,
  emptyUsageTotals,
  type UsageBreakdownEntry,
  type UsageRow,
  type UsageTotals,
} from "./usage.ts";

/** Minimal event shape — avoids importing eve types into the mobile bundle. */
export type ThreadTraceEvent = {
  readonly type?: string;
  readonly data?: {
    readonly turnId?: unknown;
    readonly modelId?: unknown;
    readonly message?: unknown;
    readonly stepIndex?: unknown;
    readonly usage?: {
      readonly costUsd?: unknown;
      readonly inputTokens?: unknown;
      readonly outputTokens?: unknown;
      readonly cacheReadTokens?: unknown;
      readonly cacheWriteTokens?: unknown;
    };
  };
  readonly meta?: {
    readonly at?: unknown;
  };
};

export type ThreadTraceCall = {
  readonly turnId: string | null;
  readonly stepIndex: number | null;
  readonly modelId: string | null;
  readonly createdAt: Date | null;
  readonly costUsd: number | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
};

export type ThreadTraceTurn = {
  readonly turnId: string | null;
  readonly label: string;
  readonly calls: readonly ThreadTraceCall[];
};

export type ThreadTrace = {
  readonly totals: UsageTotals;
  /** Distinct turns that produced at least one model call. */
  readonly turns: number;
  readonly byModel: readonly UsageBreakdownEntry[];
  /** Model calls in stream order, grouped by turn. */
  readonly callTurns: readonly ThreadTraceTurn[];
};

const TURN_LABEL_MAX = 72;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function truncateLabel(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= TURN_LABEL_MAX) {
    return collapsed;
  }

  return `${collapsed.slice(0, TURN_LABEL_MAX - 1).trimEnd()}…`;
}

/**
 * Builds a cost breakdown and ordered call trace from a chat's stream events.
 */
export function threadTraceFromEvents(
  events: readonly ThreadTraceEvent[],
): ThreadTrace {
  const modelByStep = new Map<string, string | null>();
  const modelByTurn = new Map<string, string | null>();
  const turnLabels = new Map<string, string>();
  const calls: ThreadTraceCall[] = [];

  for (const event of events) {
    const turnId = asString(event.data?.turnId);

    if (event.type === "message.received" && turnId) {
      const message = asString(event.data?.message);
      if (message && !turnLabels.has(turnId)) {
        turnLabels.set(turnId, truncateLabel(message));
      }
      continue;
    }

    if (event.type === "step.started" && turnId) {
      const modelId = asString(event.data?.modelId);
      const stepIndex = asNumber(event.data?.stepIndex);
      modelByTurn.set(turnId, modelId);
      if (stepIndex !== null) {
        modelByStep.set(`${turnId}::${stepIndex}`, modelId);
      }
      continue;
    }

    if (event.type !== "step.completed") {
      continue;
    }

    const usage = event.data?.usage;
    const stepIndex = asNumber(event.data?.stepIndex);
    const modelId =
      turnId && stepIndex !== null
        ? (modelByStep.get(`${turnId}::${stepIndex}`) ??
          modelByTurn.get(turnId) ??
          null)
        : turnId
          ? (modelByTurn.get(turnId) ?? null)
          : null;

    calls.push({
      cacheReadTokens: asNumber(usage?.cacheReadTokens),
      cacheWriteTokens: asNumber(usage?.cacheWriteTokens),
      costUsd: asNumber(usage?.costUsd),
      createdAt: asDate(event.meta?.at),
      inputTokens: asNumber(usage?.inputTokens),
      modelId,
      outputTokens: asNumber(usage?.outputTokens),
      stepIndex,
      turnId,
    });
  }

  if (calls.length === 0) {
    return {
      byModel: [],
      callTurns: [],
      totals: emptyUsageTotals(),
      turns: 0,
    };
  }

  const rows: UsageRow[] = calls.map((call, index) => ({
    cacheReadTokens: call.cacheReadTokens,
    cacheWriteTokens: call.cacheWriteTokens,
    chatId: "thread",
    costUsd: call.costUsd,
    createdAt: call.createdAt ?? new Date(0),
    inputTokens: call.inputTokens,
    modelId: call.modelId,
    outputTokens: call.outputTokens,
    turnId: call.turnId ?? `anon-${index}`,
  }));

  const summary = aggregateUsage(rows);

  type MutableTurn = {
    turnId: string | null;
    label: string;
    calls: ThreadTraceCall[];
  };

  const groups: MutableTurn[] = [];

  for (const call of calls) {
    const last = groups[groups.length - 1];
    if (last && call.turnId !== null && last.turnId === call.turnId) {
      last.calls.push(call);
      continue;
    }

    const ordinal = groups.length + 1;
    groups.push({
      calls: [call],
      label: call.turnId
        ? (turnLabels.get(call.turnId) ?? `Turn ${ordinal}`)
        : `Turn ${ordinal}`,
      turnId: call.turnId,
    });
  }

  return {
    byModel: summary.byModel,
    callTurns: groups,
    totals: summary.totals,
    turns: summary.turns,
  };
}
