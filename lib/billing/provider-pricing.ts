/**
 * Authoritative provider list prices used when a call does not report a
 * dollar cost (or when we need a reservation). Prefer a reported total when
 * the provider returns one.
 *
 * Ledger storage uses integer microdollars (1 USD = 1_000_000 micros) so
 * rates like $0.007 stay exact. Presentation rounds only when formatting.
 *
 * Sources:
 * - Exa Search via AI Gateway: $7 / 1k auto|fast, $4 / 1k instant
 *   (https://vercel.com/docs/ai-gateway/models-and-providers/web-search)
 * - Exa Agent effort table: https://exa.ai/docs/admin/pricing
 * - Image models: AI Gateway model pages (per-image list price)
 */

export const MICROS_PER_USD = 1_000_000;
export const MICROS_PER_CENT = 10_000;

/** Default eve `web_search` is Exa `auto` through AI Gateway ($0.007). */
export const EXA_SEARCH_AUTO_MICROS = 7_000;
export const EXA_SEARCH_INSTANT_MICROS = 4_000;
/** Extra result above the included 10, per result ($0.001). */
export const EXA_SEARCH_EXTRA_RESULT_MICROS = 1_000;

export const EXA_SEARCH_AUTO_USD = EXA_SEARCH_AUTO_MICROS / MICROS_PER_USD;
export const EXA_SEARCH_INSTANT_USD = EXA_SEARCH_INSTANT_MICROS / MICROS_PER_USD;
export const EXA_SEARCH_EXTRA_RESULT_USD =
  EXA_SEARCH_EXTRA_RESULT_MICROS / MICROS_PER_USD;

/** Fixed Exa Agent effort prices (per run). `auto` / `ultra` are metered. */
export const EXA_AGENT_EFFORT_MICROS: Readonly<Record<string, number>> = {
  minimal: 12_000,
  low: 25_000,
  medium: 100_000,
  high: 500_000,
  xhigh: 1_000_000,
};

export const EXA_AGENT_EFFORT_USD: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(EXA_AGENT_EFFORT_MICROS).map(([key, micros]) => [
    key,
    micros / MICROS_PER_USD,
  ]),
);

/**
 * Per-image Gateway list prices for Pearl's allowlisted image models.
 * Token-priced models (no flat per-image rate) are omitted.
 */
export const IMAGE_MODEL_MICROS_PER_IMAGE: Readonly<Record<string, number>> = {
  "spacexai/grok-imagine-image-2.0": 60_000,
  "spacexai/grok-imagine-image": 20_000,
  "meta/muse-image-1.0": 10_000,
};

export const IMAGE_MODEL_USD_PER_IMAGE: Readonly<Record<string, number>> =
  Object.fromEntries(
    Object.entries(IMAGE_MODEL_MICROS_PER_IMAGE).map(([key, micros]) => [
      key,
      micros / MICROS_PER_USD,
    ]),
  );

/** Default reservation / unknown-model floor — matches default image model. */
export const DEFAULT_IMAGE_MICROS = 60_000;
export const DEFAULT_IMAGE_USD = DEFAULT_IMAGE_MICROS / MICROS_PER_USD;

export type ExaCostDollars = {
  readonly total: number;
  readonly agentCompute?: number;
  readonly search?: number;
  readonly emails?: number;
  readonly phoneNumbers?: number;
  readonly dataSources?: Record<string, number>;
};

/** Convert USD → microdollars for ledger writes. */
export function usdToMicros(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.round(usd * MICROS_PER_USD);
}

export function microsToUsd(micros: number): number {
  if (!Number.isFinite(micros) || micros === 0) return 0;
  return micros / MICROS_PER_USD;
}

/**
 * Presentation only. Keeps sub-cent amounts readable ($0.007) and trims
 * trailing zeros; never use this for ledger writes.
 */
export function formatSpendUsd(usd: number): string {
  if (!Number.isFinite(usd)) return "—";
  if (usd === 0) return "$0.00";
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  const fixed = usd.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return `$${fixed}`;
}

/** Rounded whole cents for Metronome / legacy caps — presentation-ish, not ledger. */
export function microsToRoundedCents(micros: number): number {
  if (!Number.isFinite(micros) || micros <= 0) return 0;
  return Math.round(micros / MICROS_PER_CENT);
}

/**
 * @deprecated Prefer usdToMicros for ledger writes. Kept for call sites that
 * still speak in cents for reservations / Metronome mirrors.
 */
export function usdToBillingCents(usd: number): number {
  return microsToRoundedCents(usdToMicros(usd));
}

/**
 * Exa Agent returns `costDollars` as an object with `total` (not a bare
 * number). Accept both shapes so older fixtures still parse.
 */
export function parseExaCostDollars(raw: unknown): ExaCostDollars | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return { total: raw };
  }
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const total = record.total;
  if (typeof total !== "number" || !Number.isFinite(total) || total < 0) {
    return null;
  }
  const num = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : undefined;

  let dataSources: Record<string, number> | undefined;
  if (record.dataSources && typeof record.dataSources === "object") {
    dataSources = {};
    for (const [key, value] of Object.entries(
      record.dataSources as Record<string, unknown>,
    )) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        dataSources[key] = value;
      }
    }
    if (Object.keys(dataSources).length === 0) {
      dataSources = undefined;
    }
  }

  return {
    total,
    agentCompute: num(record.agentCompute),
    search: num(record.search),
    emails: num(record.emails),
    phoneNumbers: num(record.phoneNumbers),
    dataSources,
  };
}

/** Fixed-effort Exa Agent fallback when the run omits costDollars. */
export function exaAgentEffortUsd(effort: string | null | undefined): number | null {
  if (!effort) return null;
  const micros = EXA_AGENT_EFFORT_MICROS[effort];
  return micros == null ? null : micros / MICROS_PER_USD;
}

export function exaAgentEffortMicros(
  effort: string | null | undefined,
): number | null {
  if (!effort) return null;
  return EXA_AGENT_EFFORT_MICROS[effort] ?? null;
}

/**
 * Exa Search (AI Gateway web_search) cost for one call. Defaults to auto.
 * Extra results beyond 10 add $0.001 each.
 */
export function exaSearchMicros(input?: {
  readonly type?: string | null;
  readonly numResults?: number | null;
}): number {
  const type = (input?.type ?? "auto").toLowerCase();
  const base =
    type === "instant" || type === "lite"
      ? EXA_SEARCH_INSTANT_MICROS
      : EXA_SEARCH_AUTO_MICROS;
  const numResults =
    typeof input?.numResults === "number" && Number.isFinite(input.numResults)
      ? Math.max(0, Math.floor(input.numResults))
      : 10;
  const extra = Math.max(0, numResults - 10) * EXA_SEARCH_EXTRA_RESULT_MICROS;
  return base + extra;
}

export function exaSearchUsd(input?: {
  readonly type?: string | null;
  readonly numResults?: number | null;
}): number {
  return microsToUsd(exaSearchMicros(input));
}

/** Resolve image cost: reported USD wins, else catalog list price. */
export function imageMicros(input: {
  readonly modelId: string;
  readonly reportedUsd?: number | null;
  readonly imageCount?: number;
}): {
  readonly micros: number;
  readonly pricing: "provider" | "catalog" | "default";
} {
  const count = Math.max(1, input.imageCount ?? 1);
  if (
    typeof input.reportedUsd === "number" &&
    Number.isFinite(input.reportedUsd) &&
    input.reportedUsd > 0
  ) {
    return { micros: usdToMicros(input.reportedUsd), pricing: "provider" };
  }
  const perImage = IMAGE_MODEL_MICROS_PER_IMAGE[input.modelId];
  if (typeof perImage === "number") {
    return { micros: perImage * count, pricing: "catalog" };
  }
  return { micros: DEFAULT_IMAGE_MICROS * count, pricing: "default" };
}

export function imageUsd(input: {
  readonly modelId: string;
  readonly reportedUsd?: number | null;
  readonly imageCount?: number;
}): {
  readonly usd: number;
  readonly pricing: "provider" | "catalog" | "default";
} {
  const priced = imageMicros(input);
  return { usd: microsToUsd(priced.micros), pricing: priced.pricing };
}
