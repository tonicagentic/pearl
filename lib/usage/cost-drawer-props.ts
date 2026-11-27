// Pure props mappers for the thread Cost drawer elements.

import type { ThreadTrace } from "./thread-trace.ts";
import { formatUsd } from "./usage.ts";

export type CostMeterLineProps = {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cost: string;
  readonly share: number;
};

export type CostMeterDrawerProps = {
  readonly runCost: string;
  readonly sessionCost: string;
  readonly lines: readonly CostMeterLineProps[];
};

export type QuotaBannerDrawerProps = {
  readonly used: number;
  readonly limit: number;
  readonly unit: "dollars";
  readonly resetsIn: string;
};

export type BillingStatusLike = {
  /** API field from `/api/billing/status`. */
  readonly enabled?: boolean;
  readonly exempt?: boolean;
  readonly spentCents?: number | null;
  readonly usageCapCents?: number | null;
  readonly periodEnd?: string | null;
};

/** CostMeter props: run = latest turn, session = thread grand total. */
export function costMeterProps(trace: ThreadTrace): CostMeterDrawerProps {
  const modelTotal = trace.byModel.reduce(
    (sum, row) => sum + (row.costUsd ?? 0),
    0,
  );
  const lines = trace.byModel.map((row) => {
    const dollars = row.costUsd ?? 0;
    const share = modelTotal > 0 ? dollars / modelTotal : 0;
    return {
      cost: formatUsd(row.costUsd),
      inputTokens: row.inputTokens ?? 0,
      model: row.label,
      outputTokens: row.outputTokens ?? 0,
      share,
    };
  });

  return {
    lines,
    runCost: formatUsd(trace.lastTurnCostUsd),
    sessionCost: formatUsd(trace.grandCostUsd),
  };
}

function formatResetsIn(periodEnd: string | null | undefined, nowMs: number): string {
  if (!periodEnd) return "soon";
  const endMs = Date.parse(periodEnd);
  if (!Number.isFinite(endMs)) return "soon";
  const delta = Math.max(0, endMs - nowMs);
  const minutes = Math.round(delta / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

/**
 * QuotaBanner props from billing status, or null when billing is off,
 * the account is exempt, or there is no spend cap.
 */
export function quotaBannerProps(
  billing: BillingStatusLike | null | undefined,
  options?: { readonly nowMs?: number },
): QuotaBannerDrawerProps | null {
  if (!billing || billing.enabled === false || billing.exempt) {
    return null;
  }
  const capCents = billing.usageCapCents;
  if (capCents == null || !(capCents > 0)) {
    return null;
  }
  const spentCents = Math.max(0, billing.spentCents ?? 0);
  return {
    limit: Math.round(capCents) / 100,
    resetsIn: formatResetsIn(billing.periodEnd, options?.nowMs ?? Date.now()),
    unit: "dollars",
    used: Math.round(spentCents) / 100,
  };
}
