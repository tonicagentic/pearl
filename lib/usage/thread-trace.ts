// Per-thread cost breakdown from the live eve event log.
//
// Current eve facts: `model.started` (model id) + `usage.recorded` (nested
// `data.usage` tokens/cost), with turn id on `scope.turnId` or delivery/
// turn events. Legacy chats still carry `step.started` / `step.completed`.

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
    readonly runId?: unknown;
    readonly modelId?: unknown;
    readonly message?: unknown;
    readonly stepIndex?: unknown;
    readonly kind?: unknown;
    readonly owner?: {
      readonly runId?: unknown;
      readonly callId?: unknown;
      readonly turnId?: unknown;
      readonly changeId?: unknown;
    };
    readonly parts?: readonly {
      readonly kind?: unknown;
      readonly text?: unknown;
      readonly type?: unknown;
    }[];
    readonly usage?: {
      readonly costUsd?: unknown;
      readonly inputTokens?: unknown;
      readonly outputTokens?: unknown;
      readonly cacheReadTokens?: unknown;
      readonly cacheWriteTokens?: unknown;
    };
    // Legacy flat usage fields (pre-nested `usage.recorded`).
    readonly costUsd?: unknown;
    readonly inputTokens?: unknown;
    readonly outputTokens?: unknown;
    readonly cacheReadTokens?: unknown;
    readonly cacheWriteTokens?: unknown;
  };
  readonly scope?: {
    readonly turnId?: unknown;
    readonly runId?: unknown;
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

function turnIdOf(event: ThreadTraceEvent): string | null {
  return (
    asString(event.scope?.turnId) ??
    asString(event.data?.turnId) ??
    asString(event.data?.owner?.turnId)
  );
}

function runIdOf(event: ThreadTraceEvent): string | null {
  return (
    asString(event.data?.runId) ??
    asString(event.data?.owner?.runId) ??
    asString(event.scope?.runId)
  );
}

function usageOf(event: ThreadTraceEvent): {
  readonly costUsd: number | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
} {
  const nested = event.data?.usage;
  if (nested && typeof nested === "object") {
    return {
      cacheReadTokens: asNumber(nested.cacheReadTokens),
      cacheWriteTokens: asNumber(nested.cacheWriteTokens),
      costUsd: asNumber(nested.costUsd),
      inputTokens: asNumber(nested.inputTokens),
      outputTokens: asNumber(nested.outputTokens),
    };
  }

  // Legacy step.completed / flattened usage.recorded payloads.
  return {
    cacheReadTokens: asNumber(event.data?.cacheReadTokens),
    cacheWriteTokens: asNumber(event.data?.cacheWriteTokens),
    costUsd: asNumber(event.data?.costUsd),
    inputTokens: asNumber(event.data?.inputTokens),
    outputTokens: asNumber(event.data?.outputTokens),
  };
}

function userTextFromDelivery(event: ThreadTraceEvent): string | null {
  const parts = event.data?.parts;
  if (!Array.isArray(parts)) {
    return asString(event.data?.message);
  }

  const chunks: string[] = [];
  for (const part of parts) {
    const kind = asString(part?.kind) ?? asString(part?.type);
    const text = asString(part?.text);
    if ((kind === "text" || kind === null) && text) {
      chunks.push(text);
    }
  }
  if (chunks.length === 0) {
    return asString(event.data?.message);
  }
  return chunks.join("\n");
}

/**
 * Builds a cost breakdown and ordered call trace from a chat's stream events.
 */
export function threadTraceFromEvents(
  events: readonly ThreadTraceEvent[],
): ThreadTrace {
  const modelByStep = new Map<string, string | null>();
  const modelByTurn = new Map<string, string | null>();
  const modelByRun = new Map<string, string | null>();
  const turnByRun = new Map<string, string | null>();
  const turnLabels = new Map<string, string>();
  const calls: ThreadTraceCall[] = [];

  for (const event of events) {
    const turnId = turnIdOf(event);
    const runId = runIdOf(event);

    if (
      (event.type === "message.received" ||
        event.type === "delivery.consumed") &&
      turnId
    ) {
      const message =
        event.type === "delivery.consumed"
          ? userTextFromDelivery(event)
          : asString(event.data?.message);
      if (message && !turnLabels.has(turnId)) {
        turnLabels.set(turnId, truncateLabel(message));
      }
      continue;
    }

    if (event.type === "model.requested" && runId) {
      const ownerTurn =
        asString(event.data?.owner?.turnId) ?? turnId;
      if (ownerTurn) {
        turnByRun.set(runId, ownerTurn);
      }
      continue;
    }

    if (event.type === "model.started" && runId) {
      const modelId = asString(event.data?.modelId);
      modelByRun.set(runId, modelId);
      const ownerTurn = turnByRun.get(runId) ?? turnId;
      if (ownerTurn) {
        turnByRun.set(runId, ownerTurn);
        modelByTurn.set(ownerTurn, modelId);
      }
      continue;
    }

    // Legacy step.started — still present in older persisted chats.
    if (event.type === "step.started" && turnId) {
      const modelId = asString(event.data?.modelId);
      const stepIndex = asNumber(event.data?.stepIndex);
      modelByTurn.set(turnId, modelId);
      if (stepIndex !== null) {
        modelByStep.set(`${turnId}::${stepIndex}`, modelId);
      }
      continue;
    }

    if (event.type === "usage.recorded") {
      const kind = asString(event.data?.kind);
      // Skip parent rollups of delegated spend (same filter as billing-usage).
      if (kind === "delegated-late") {
        continue;
      }
      if (
        asString(event.data?.owner?.callId) &&
        !asString(event.data?.owner?.runId)
      ) {
        continue;
      }

      const usage = usageOf(event);
      const resolvedTurn =
        turnId ??
        (runId ? (turnByRun.get(runId) ?? null) : null);
      const modelId = runId
        ? (modelByRun.get(runId) ??
          (resolvedTurn ? (modelByTurn.get(resolvedTurn) ?? null) : null))
        : resolvedTurn
          ? (modelByTurn.get(resolvedTurn) ?? null)
          : null;

      calls.push({
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        costUsd: usage.costUsd,
        createdAt: asDate(event.meta?.at),
        inputTokens: usage.inputTokens,
        modelId,
        outputTokens: usage.outputTokens,
        stepIndex: null,
        turnId: resolvedTurn,
      });
      continue;
    }

    if (event.type !== "step.completed") {
      continue;
    }

    // Legacy step.completed with nested or flat usage.
    const usage = usageOf(event);
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
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      costUsd: usage.costUsd,
      createdAt: asDate(event.meta?.at),
      inputTokens: usage.inputTokens,
      modelId,
      outputTokens: usage.outputTokens,
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
