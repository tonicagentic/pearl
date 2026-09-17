// Per-user usage aggregation over the persisted chat event log.
//
// Source of truth: eve emits a `step.completed` stream event for every model
// call with `data.usage` ({ costUsd?, inputTokens?, outputTokens?,
// cacheReadTokens?, cacheWriteTokens? }). The web app persists every stream
// event into `chat_event` (see onEvent → appendClientChatEvent), and each row
// is attributed to a user through `chat.user_id`. This module turns those
// rows into the settings page's usage summary.
//
// Known gaps (documented in the UI):
// - Events persist while the browser tab streams the turn; a closed tab can
//   lose the tail of a turn.
// - Browser-storage chats (storageMode "browser") never reach the database.
// - Compaction model calls inside eve's session harness are not surfaced as
//   `step.completed` stream events, so their tokens are not counted.

export type UsageRow = {
  readonly chatId: string;
  readonly turnId: string | null;
  readonly modelId: string | null;
  readonly createdAt: Date;
  readonly costUsd: number | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
};

export type UsageTotals = {
  readonly modelCalls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  /** null when no step reported a cost (e.g. BYOK keys without pricing). */
  readonly costUsd: number | null;
};

export type UsageBreakdownEntry = UsageTotals & {
  readonly label: string;
};

export type UserUsageSummary = {
  readonly totals: UsageTotals;
  /** Distinct (chat, turn) pairs with at least one counted model call. */
  readonly turns: number;
  /** UTC calendar-day buckets; `day` is the label. */
  readonly byDay: readonly (UsageTotals & { readonly day: string })[];
  readonly byChat: readonly (UsageBreakdownEntry & {
    readonly chatId: string;
  })[];
  readonly byModel: readonly UsageBreakdownEntry[];
};

const ZERO: UsageTotals = {
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costUsd: null,
  inputTokens: 0,
  modelCalls: 0,
  outputTokens: 0,
};

function addUsage(
  accumulator: UsageTotals,
  row: Pick<
    UsageRow,
    "costUsd" | "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens"
  >,
): UsageTotals {
  const num = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

  return {
    cacheReadTokens: accumulator.cacheReadTokens + num(row.cacheReadTokens),
    cacheWriteTokens: accumulator.cacheWriteTokens + num(row.cacheWriteTokens),
    costUsd:
      accumulator.costUsd === null && row.costUsd === null
        ? null
        : (accumulator.costUsd ?? 0) + num(row.costUsd),
    inputTokens: accumulator.inputTokens + num(row.inputTokens),
    modelCalls: accumulator.modelCalls + 1,
    outputTokens: accumulator.outputTokens + num(row.outputTokens),
  };
}

function mergeUsage(first: UsageTotals, second: UsageTotals): UsageTotals {
  return {
    cacheReadTokens: first.cacheReadTokens + second.cacheReadTokens,
    cacheWriteTokens: first.cacheWriteTokens + second.cacheWriteTokens,
    costUsd:
      first.costUsd === null && second.costUsd === null
        ? null
        : (first.costUsd ?? 0) + (second.costUsd ?? 0),
    inputTokens: first.inputTokens + second.inputTokens,
    modelCalls: first.modelCalls + second.modelCalls,
    outputTokens: first.outputTokens + second.outputTokens,
  };
}

export function emptyUsageTotals(): UsageTotals {
  return ZERO;
}

/**
 * Aggregates usage rows into totals plus per-day / per-chat / per-model
 * breakdowns. Days are UTC calendar days (the event `createdAt` is UTC);
 * per-chat and per-model breakdowns are sorted by cost then tokens.
 */
export function aggregateUsage(
  rows: readonly UsageRow[],
  chatTitles: Readonly<Record<string, string>>,
): UserUsageSummary {
  let totals = ZERO;
  const byDay = new Map<string, UsageTotals>();
  const byChat = new Map<string, UsageTotals>();
  const byModel = new Map<string, UsageTotals>();

  for (const row of rows) {
    totals = addUsage(totals, row);

    const day = row.createdAt.toISOString().slice(0, 10);
    byDay.set(day, addUsage(byDay.get(day) ?? ZERO, row));

    byChat.set(row.chatId, addUsage(byChat.get(row.chatId) ?? ZERO, row));

    const model = row.modelId ?? "unknown";
    byModel.set(model, addUsage(byModel.get(model) ?? ZERO, row));
  }

  const compare = (a: UsageTotals, b: UsageTotals) =>
    (b.costUsd ?? 0) - (a.costUsd ?? 0) ||
    b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens);

  const turns = new Set(
    rows
      .filter((row) => row.turnId)
      .map((row) => `${row.chatId}::${row.turnId}`),
  ).size;

  const entry = (label: string, usage: UsageTotals): UsageBreakdownEntry => ({
    ...usage,
    label,
  });

  return {
    byChat: [...byChat.entries()]
      .map(([chatId, usage]) => ({
        chatId,
        label: chatTitles[chatId] ?? chatId,
        ...usage,
      }))
      .sort((a, b) => compare(a, b)),
    byDay: [...byDay.entries()]
      .map(([day, usage]) => ({ day, ...usage }))
      .sort((a, b) => (a.day < b.day ? -1 : 1)),
    byModel: [...byModel.entries()]
      .map(([label, usage]) => entry(label, usage))
      .sort((a, b) => compare(a, b)),
    totals,
    turns,
  };
}

export function formatUsd(costUsd: number | null): string {
  if (costUsd === null) {
    return "—";
  }

  if (costUsd >= 1) {
    return `$${costUsd.toFixed(2)}`;
  }

  if (costUsd >= 0.01) {
    return `$${costUsd.toFixed(3)}`;
  }

  return `$${costUsd.toFixed(4)}`;
}

export function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(count % 1_000_000 === 0 ? 0 : 1)}M`;
  }

  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(count % 1_000 === 0 ? 0 : 1)}k`;
  }

  return String(count);
}
