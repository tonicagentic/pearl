// Per-thread cost breakdown from the live eve event log.
//
// Models: `model.started` + `usage.recorded` (and legacy `step.*`).
// Tools: `call.requested` + `call.settled` for web_search / generate_image /
// exa_agent_run, priced from tool output or published list rates.
// Subagent *model* spend that lands as `usage.recorded` on this thread is
// already included in model totals; parent `delegated-late` rollups are skipped.

import {
  exaAgentEffortUsd,
  exaSearchUsd,
  imageUsd,
  parseExaCostDollars,
} from "../billing/provider-pricing.ts";
import { usageSourceMeta } from "./sources.ts";
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
    readonly callId?: unknown;
    readonly modelId?: unknown;
    readonly message?: unknown;
    readonly stepIndex?: unknown;
    readonly kind?: unknown;
    readonly outcome?: unknown;
    readonly name?: unknown;
    readonly input?: unknown;
    readonly output?: unknown;
    readonly capability?: {
      readonly kind?: unknown;
      readonly name?: unknown;
      readonly label?: unknown;
    };
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

export type ThreadTraceToolSource =
  | "web_search"
  | "image"
  | "exa_agent"
  | "sandbox"
  | string;

export type ThreadTraceToolCharge = {
  readonly turnId: string | null;
  readonly callId: string | null;
  readonly source: ThreadTraceToolSource;
  readonly label: string;
  readonly detail: string | null;
  readonly costUsd: number;
  readonly createdAt: Date | null;
};

export type ThreadTraceToolSourceRow = {
  readonly source: ThreadTraceToolSource;
  readonly label: string;
  readonly costUsd: number;
  readonly count: number;
};

export type ThreadTraceTurn = {
  readonly turnId: string | null;
  readonly label: string;
  readonly calls: readonly ThreadTraceCall[];
  readonly tools: readonly ThreadTraceToolCharge[];
};

export type ThreadTrace = {
  /** Model-only totals (tokens + model cost). */
  readonly totals: UsageTotals;
  /** Distinct turns that produced at least one model call. */
  readonly turns: number;
  readonly byModel: readonly UsageBreakdownEntry[];
  /** Tool charges (search / image / Exa research) from call.settled. */
  readonly tools: {
    readonly costUsd: number;
    readonly count: number;
    readonly bySource: readonly ThreadTraceToolSourceRow[];
    readonly charges: readonly ThreadTraceToolCharge[];
  };
  /** Model cost + tool cost; null only when both are empty/unknown. */
  readonly grandCostUsd: number | null;
  /** Model calls in stream order, grouped by turn (tools nested per turn). */
  readonly callTurns: readonly ThreadTraceTurn[];
};

const TURN_LABEL_MAX = 72;

const TOOL_SOURCES = new Set(["web_search", "generate_image", "exa_agent_run"]);

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

function sourceForTool(toolName: string): ThreadTraceToolSource | null {
  switch (toolName) {
    case "web_search":
      return "web_search";
    case "generate_image":
      return "image";
    case "exa_agent_run":
      return "exa_agent";
    default:
      return null;
  }
}

function priceToolCall(input: {
  readonly toolName: string;
  readonly toolInput: unknown;
  readonly output: unknown;
}): { readonly costUsd: number; readonly detail: string | null } | null {
  const output =
    input.output && typeof input.output === "object"
      ? (input.output as Record<string, unknown>)
      : null;
  const toolInput =
    input.toolInput && typeof input.toolInput === "object"
      ? (input.toolInput as Record<string, unknown>)
      : null;

  if (input.toolName === "web_search") {
    // Prefer a reported dollar cost on the tool result; else Exa list rate.
    const reported =
      asNumber(output?.costUsd) ??
      parseExaCostDollars(output?.costDollars)?.total ??
      null;
    const searchType = asString(output?.type) ?? asString(toolInput?.type);
    const numResults =
      asNumber(output?.numResults) ??
      (Array.isArray(output?.results) ? output.results.length : null);
    const costUsd =
      reported != null && reported > 0
        ? reported
        : exaSearchUsd({ type: searchType, numResults });
    return {
      costUsd,
      detail: searchType ? `Exa ${searchType}` : "Exa auto",
    };
  }

  if (input.toolName === "generate_image") {
    if (output?.success === false) {
      return null;
    }
    const modelId =
      asString(output?.model) ?? "spacexai/grok-imagine-image-2.0";
    const reported = asNumber(output?.costUsd);
    const priced = imageUsd({
      modelId,
      reportedUsd: reported,
      imageCount: 1,
    });
    return { costUsd: priced.usd, detail: modelId };
  }

  if (input.toolName === "exa_agent_run") {
    if (asString(output?.status) === "error") {
      return null;
    }
    const reported = parseExaCostDollars(output?.costDollars)?.total ?? null;
    const effort = asString(output?.effort) ?? asString(toolInput?.effort);
    const fallback = exaAgentEffortUsd(effort);
    const costUsd =
      reported != null && reported > 0 ? reported : (fallback ?? 0);
    if (costUsd <= 0) {
      return null;
    }
    return {
      costUsd,
      detail: effort ? `Exa Agent · ${effort}` : "Exa Agent",
    };
  }

  return null;
}

function sumCosts(
  modelCost: number | null,
  toolCost: number,
): number | null {
  if (modelCost === null && toolCost <= 0) {
    return null;
  }
  return (modelCost ?? 0) + toolCost;
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
  const toolCharges: ThreadTraceToolCharge[] = [];
  const pendingCalls = new Map<
    string,
    {
      readonly name: string;
      readonly turnId: string | null;
      readonly input: unknown;
    }
  >();

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
      const ownerTurn = asString(event.data?.owner?.turnId) ?? turnId;
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

    if (event.type === "call.requested") {
      const callId = asString(event.data?.callId);
      const name =
        asString(event.data?.capability?.name) ?? asString(event.data?.name);
      if (!callId || !name || !TOOL_SOURCES.has(name)) {
        continue;
      }
      const ownerTurn =
        asString(event.data?.owner?.turnId) ??
        turnId ??
        (runId ? (turnByRun.get(runId) ?? null) : null);
      const ownerRun = asString(event.data?.owner?.runId) ?? runId;
      if (ownerRun && ownerTurn) {
        turnByRun.set(ownerRun, ownerTurn);
      }
      pendingCalls.set(callId, {
        name,
        turnId: ownerTurn,
        input: event.data?.input,
      });
      continue;
    }

    if (event.type === "call.settled") {
      const callId = asString(event.data?.callId);
      const pending = callId ? pendingCalls.get(callId) : undefined;
      if (callId) {
        pendingCalls.delete(callId);
      }
      if (!pending) {
        continue;
      }
      const outcome = asString(event.data?.outcome);
      if (outcome && outcome !== "completed") {
        continue;
      }
      const priced = priceToolCall({
        toolName: pending.name,
        toolInput: pending.input,
        output: event.data?.output,
      });
      if (!priced || priced.costUsd <= 0) {
        continue;
      }
      const source = sourceForTool(pending.name);
      if (!source) {
        continue;
      }
      const meta = usageSourceMeta(source);
      toolCharges.push({
        callId,
        costUsd: priced.costUsd,
        createdAt: asDate(event.meta?.at),
        detail: priced.detail,
        label: meta.label,
        source,
        turnId: pending.turnId ?? turnId,
      });
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
        turnId ?? (runId ? (turnByRun.get(runId) ?? null) : null);
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

  const emptyTools = {
    bySource: [] as ThreadTraceToolSourceRow[],
    charges: [] as ThreadTraceToolCharge[],
    costUsd: 0,
    count: 0,
  };

  if (calls.length === 0 && toolCharges.length === 0) {
    return {
      byModel: [],
      callTurns: [],
      grandCostUsd: null,
      tools: emptyTools,
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

  const summary =
    rows.length > 0
      ? aggregateUsage(rows)
      : {
          byModel: [] as UsageBreakdownEntry[],
          totals: emptyUsageTotals(),
          turns: 0,
        };

  const bySourceMap = new Map<
    string,
    { source: string; label: string; costUsd: number; count: number }
  >();
  for (const charge of toolCharges) {
    const existing = bySourceMap.get(charge.source);
    if (existing) {
      existing.costUsd += charge.costUsd;
      existing.count += 1;
    } else {
      bySourceMap.set(charge.source, {
        count: 1,
        costUsd: charge.costUsd,
        label: charge.label,
        source: charge.source,
      });
    }
  }
  const bySource = [...bySourceMap.values()].sort(
    (a, b) => b.costUsd - a.costUsd || a.label.localeCompare(b.label),
  );
  const toolCostUsd = toolCharges.reduce((sum, charge) => sum + charge.costUsd, 0);

  type MutableTurn = {
    turnId: string | null;
    label: string;
    calls: ThreadTraceCall[];
    tools: ThreadTraceToolCharge[];
  };

  // Preserve model-call stream order for turns, then attach tools.
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
      tools: [],
      turnId: call.turnId,
    });
  }

  const byTurnId = new Map<string, MutableTurn>();
  for (const group of groups) {
    if (group.turnId) byTurnId.set(group.turnId, group);
  }

  for (const charge of toolCharges) {
    if (charge.turnId && byTurnId.has(charge.turnId)) {
      byTurnId.get(charge.turnId)!.tools.push(charge);
      continue;
    }
    if (charge.turnId) {
      const ordinal = groups.length + 1;
      const group: MutableTurn = {
        calls: [],
        label: turnLabels.get(charge.turnId) ?? `Turn ${ordinal}`,
        tools: [charge],
        turnId: charge.turnId,
      };
      groups.push(group);
      byTurnId.set(charge.turnId, group);
      continue;
    }
    const last = groups[groups.length - 1];
    if (last) {
      last.tools.push(charge);
    } else {
      groups.push({
        calls: [],
        label: "Tools",
        tools: [charge],
        turnId: null,
      });
    }
  }

  // Prefer grouped callTurns (includes tool-only turns) over model-only count.
  const turns = Math.max(summary.turns, groups.length);

  return {
    byModel: summary.byModel,
    callTurns: groups,
    grandCostUsd: sumCosts(summary.totals.costUsd, toolCostUsd),
    tools: {
      bySource,
      charges: toolCharges,
      costUsd: toolCostUsd,
      count: toolCharges.length,
    },
    totals: summary.totals,
    turns,
  };
}
